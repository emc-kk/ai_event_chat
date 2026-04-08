import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, Dict, Any, List
from ulid import ULID
from llama_index.vector_stores.postgres import PGVectorStore

logger = logging.getLogger(__name__)

from ..config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    EMBEDDING_DIM,
    HNSW_CONFIG,
)

def create_vector_store():
    vector_store = PGVectorStore.from_params(
        database=POSTGRES_DB,
        host=POSTGRES_HOST,
        password=POSTGRES_PASSWORD,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        embed_dim=EMBEDDING_DIM,
        hybrid_search=True,
        text_search_config="english",
        hnsw_kwargs=HNSW_CONFIG,
    )
    return vector_store

class DatabaseConnection:
    def __init__(self):
        self.conn = None
        
    def connect(self):
        try:
            self.conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                database=POSTGRES_DB,
            )
            return self.conn
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def close(self):
        if self.conn:
            self.conn.close()
            logger.debug("Database connection closed")

    def execute_query(self, query, params=None, fetch=False):
        try:
            if self.conn is None or self.conn.closed:
                logger.debug("Database connection lost, reconnecting...")
                self.connect()
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                if fetch:
                    return cursor.fetchall()
                self.conn.commit()
                return cursor.rowcount
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            logger.debug(f"Database connection error, attempting reconnect: {e}")
            try:
                if self.conn and not self.conn.closed:
                    self.conn.close()
                self.connect()

                with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(query, params)
                    if fetch:
                        return cursor.fetchall()
                    self.conn.commit()
                    return cursor.rowcount
            except Exception as retry_e:
                logger.error(f"Query execution failed after retry: {retry_e}")
                raise
        except Exception as e:
            try:
                self.conn.rollback()
            except:
                pass
            logger.error(f"Query execution failed: {e}")
            raise

def get_request_data(request_id: str, get_all_contents: bool = False) -> Optional[Dict[str, Any]]:
    db = DatabaseConnection()
    try:
        db.connect()
        
        query = """
            SELECT 
                r.id as request_id,
                r.name as request_name,
                r.description as request_description,
                r.topic_id,
                t.name as topic_name,
                t.description as topic_description
            FROM requests r
            LEFT JOIN topics t ON r.topic_id = t.id
            WHERE r.id = %s
            LIMIT 1
        """
        
        results = db.execute_query(query, (request_id,), fetch=True)
        
        if not results or len(results) == 0:
            logger.warning(f"Request not found: {request_id}")
            return None

        request_row = results[0]

        if get_all_contents:
            content_query = """
                SELECT context, created_at
                FROM request_contents
                WHERE request_id = %s
                ORDER BY created_at ASC
            """
        else:
            content_query = """
                SELECT context
                FROM request_contents
                WHERE request_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """
        
        content_results = db.execute_query(content_query, (request_id,), fetch=True)
        
        request_context = ""
        if content_results and len(content_results) > 0:
            if get_all_contents:
                contexts = []
                for idx, row in enumerate(content_results, 1):
                    context_text = row.get('context', '') or ''
                    if context_text:
                        contexts.append(f"{idx}. {context_text}")
                request_context = "\n\n".join(contexts)
            else:
                request_context = content_results[0].get('context', '') or ''
        
        return {
            'id': request_row['request_id'],
            'name': request_row['request_name'] or '',
            'description': request_row['request_description'] or '',
            'context': request_context,
            'topic': {
                'id': request_row['topic_id'],
                'name': request_row['topic_name'] or '',
                'description': request_row['topic_description'] or ''
            }
        }

    except Exception as e:
        logger.error(f"Error fetching request data: {e}")
        raise
    finally:
        db.close()

def get_topic_data(db: DatabaseConnection, topic_id: int) -> Optional[Dict[str, Any]]:
    try:
        query = """
            SELECT id, name, description
            FROM topics
            WHERE id = %s
            LIMIT 1
        """

        results = db.execute_query(query, (topic_id,), fetch=True)

        if not results or len(results) == 0:
            logger.warning(f"Topic not found: {topic_id}")
            return None

        row = results[0]
        return {
            'id': row['id'],
            'name': row.get('name', '') or '',
            'description': row.get('description', '') or ''
        }

    except Exception as e:
        logger.error(f"Error fetching topic data: {e}")
        return None

def get_document_mapping_for_directory(db: DatabaseConnection, request_id: int, directory_path: str) -> Dict[str, int]:
    try:
        query = """
            SELECT id, key
            FROM request_documents
            WHERE request_id = %s AND key LIKE %s
        """
        doc_rows = db.execute_query(
            query,
            (request_id, f"%{directory_path}%"),
            fetch=True,
        )
        
        if not doc_rows:
            return {}
        
        s3key_to_id = {row['key']: row['id'] for row in doc_rows}
        relative_to_id = {}
        dir_prefix1 = f"{directory_path}/"
        dir_prefix2 = directory_path
        
        for key, doc_id in s3key_to_id.items():
            rel = key
            if rel.startswith(dir_prefix1):
                rel = rel[len(dir_prefix1):]
            elif rel.startswith(dir_prefix2):
                rel = rel[len(dir_prefix2):].lstrip('/')
            relative_to_id[rel] = doc_id
        
        return relative_to_id

    except Exception as e:
        logger.error(f"Error fetching document mapping: {e}")
        return {}


def count_indexed_documents(request_id: str) -> int:
    db = DatabaseConnection()
    try:
        db.connect()
        
        query = """
            SELECT COUNT(DISTINCT rd.id) as doc_count
            FROM request_documents rd
            WHERE rd.request_id = %s
        """
        
        results = db.execute_query(query, (request_id,), fetch=True)
        
        if not results or len(results) == 0:
            return 0
        
        doc_count = results[0].get('doc_count', 0) or 0
        return int(doc_count)

    except Exception as e:
        logger.warning(f"Error counting indexed documents: {e}")
        return 0
    finally:
        db.close()


def update_document_status(db: DatabaseConnection, document_id: int, status: str):
    status_map = {'pending': 0, 'processing': 1, 'completed': 2, 'failed': 3}
    status_value = status_map.get(status, status)

    query = """
        UPDATE request_documents
        SET status = %s, updated_at = NOW()
        WHERE id = %s
    """
    db.execute_query(query, (status_value, document_id))
    logger.debug(f"Document {document_id} status updated to: {status}")


REQUEST_STATUS_MAP = {
    'not_started': 0,
    'inhearing': 1,
    'awaiting_verification': 2,
    'in_verification': 3,
    'rehearing': 4,
    'completed': 5,
    'deleted': 6,
    'updating': 7,
    'error': 8
}

TOPIC_STATUS_MAP = {
    'not_started': 0,
    'in_progress': 1,
    'completed': 2
}

def update_request_status(db: DatabaseConnection, request_id: int, status: str):
    status_value = REQUEST_STATUS_MAP.get(status, status)

    query = """
        UPDATE requests
        SET status = %s, updated_at = NOW()
        WHERE id = %s
    """
    db.execute_query(query, (status_value, request_id))
    logger.debug(f"Request {request_id} status updated to: {status}")

    # Railsのafter_saveコールバック相当: トピックステータスを連動更新
    _sync_topic_status_from_request(db, request_id)


def _sync_topic_status_from_request(db: DatabaseConnection, request_id: int):
    """リクエストのステータス変更に連動してトピックステータスを更新する"""
    try:
        # リクエストが属するトピックIDを取得
        topic_query = """
            SELECT topic_id FROM requests WHERE id = %s AND deleted_at IS NULL
        """
        result = db.execute_query(topic_query, (request_id,), fetch=True)
        if not result:
            return

        topic_id = result[0]['topic_id']
        if not topic_id:
            return

        # トピックに属する全リクエストのステータスを取得
        requests_query = """
            SELECT status FROM requests
            WHERE topic_id = %s AND deleted_at IS NULL
        """
        requests_result = db.execute_query(requests_query, (topic_id,), fetch=True)

        if not requests_result:
            new_topic_status = 'not_started'
        elif all(row['status'] == REQUEST_STATUS_MAP['completed'] for row in requests_result):
            new_topic_status = 'completed'
        else:
            new_topic_status = 'in_progress'

        topic_status_value = TOPIC_STATUS_MAP[new_topic_status]

        update_query = """
            UPDATE topics
            SET status = %s, updated_at = NOW()
            WHERE id = %s AND status != %s
        """
        db.execute_query(update_query, (topic_status_value, topic_id, topic_status_value))
        logger.debug(f"Topic {topic_id} status synced to: {new_topic_status}")

    except Exception as e:
        logger.error(f"Error syncing topic status for request {request_id}: {e}", exc_info=True)

def get_request_chart_path(request_id: str) -> Optional[str]:
    db = DatabaseConnection()
    try:
        db.connect()

        query = """
            SELECT chart_path
            FROM requests
            WHERE id = %s
            LIMIT 1
        """

        results = db.execute_query(query, (request_id,), fetch=True)

        if not results or len(results) == 0:
            logger.warning(f"Request not found: {request_id}")
            return None

        chart_path = results[0].get('chart_path')
        return chart_path if chart_path else None

    except Exception as e:
        logger.error(f"Error fetching chart_path: {e}")
        return None
    finally:
        db.close()


def get_request_chart_path_with_db(db: DatabaseConnection, request_id: int) -> Optional[str]:
    try:
        query = """
            SELECT chart_path
            FROM requests
            WHERE id = %s
            LIMIT 1
        """

        results = db.execute_query(query, (request_id,), fetch=True)

        if not results or len(results) == 0:
            logger.warning(f"Request not found: {request_id}")
            return None

        chart_path = results[0].get('chart_path')
        return chart_path if chart_path else None

    except Exception as e:
        logger.error(f"Error fetching chart_path: {e}")
        return None

def update_request_chart_path(db: DatabaseConnection, request_id: int, chart_path: str):
    query = """
        UPDATE requests
        SET chart_path = %s, updated_at = NOW()
        WHERE id = %s
    """
    db.execute_query(query, (chart_path, request_id))
    logger.debug(f"Request {request_id} chart_path updated to: {chart_path}")

def check_and_update_request_status(db: DatabaseConnection, request_id: int, next_status: str = 'not_started'):
    try:
        request_query = """
            SELECT status FROM requests WHERE id = %s
        """
        request_result = db.execute_query(request_query, (request_id,), fetch=True)
        if not request_result:
            logger.error(f"Request {request_id} not found")
            return

        request_status = request_result[0]['status']
        logger.debug(f"Current request status: {request_status}")

        count_query = """
            SELECT
                COUNT(*) FILTER (WHERE status = 0) as pending_count,
                COUNT(*) FILTER (WHERE status = 1) as processing_count,
                COUNT(*) FILTER (WHERE status = 2) as completed_count,
                COUNT(*) FILTER (WHERE status = 3) as failed_count,
                COUNT(*) as total_count
            FROM request_documents
            WHERE request_id = %s
        """
        result = db.execute_query(count_query, (request_id,), fetch=True)[0]

        pending_count = result['pending_count']
        processing_count = result['processing_count']
        completed_count = result['completed_count']
        failed_count = result['failed_count']
        total_count = result['total_count']

        logger.debug(f"Documents status: pending={pending_count}, processing={processing_count}, completed={completed_count}, failed={failed_count}")

        if pending_count == 0 and processing_count == 0:
            if total_count == 0:
                update_request_status(db, request_id, next_status)
            elif (completed_count + failed_count) == total_count:
                if failed_count == total_count and total_count > 0:
                    update_request_status(db, request_id, 'error')
                    logger.warning(f"Request {request_id} updated to error: all documents failed")
                else:
                    update_request_status(db, request_id, next_status)

    except Exception as e:
        logger.error(f"Error checking request status: {e}", exc_info=True)

def get_request_content(db: DatabaseConnection, request_content_id: int) -> Optional[Dict[str, Any]]:
    try:
        query = """
            SELECT id, request_id, context, created_at, updated_at
            FROM request_contents
            WHERE id = %s
        """
        results = db.execute_query(query, (request_content_id,), fetch=True)
        
        if not results or len(results) == 0:
            return None
        
        row = results[0]
        return {
            'id': row['id'],
            'request_id': row['request_id'],
            'context': row.get('context', '') or '',
            'created_at': row.get('created_at'),
            'updated_at': row.get('updated_at')
        }
    except Exception as e:
        logger.error(f"Error fetching request_content: {e}")
        return None

def get_hearing_conversations_for_room(db: DatabaseConnection, room_id: str) -> list:
    try:
        query = """
            SELECT 
                q.id as question_id,
                q.content as question,
                a.content as answer
            FROM messages q
            LEFT JOIN messages a ON a.question_id = q.id AND a.message_type = 1
            WHERE q.room_id = %s
              AND q.chat_type = 0
              AND q.message_type = 0
            ORDER BY q.created_at ASC
        """
        
        results = db.execute_query(query, (room_id,), fetch=True)
        
        conversations = []
        for row in results:
            question = row.get('question', '') or ''
            answer = row.get('answer', '') or ''
            if question and answer:
                conversations.append({
                    'question': question,
                    'answer': answer
                })
        
        return conversations

    except Exception as e:
        logger.error(f"Error fetching hearing conversations for room {room_id}: {e}", exc_info=True)
        return []

def get_request_contents_with_conversations(db: DatabaseConnection, request_id: int, exclude_request_content_id: Optional[int] = None) -> list:
    try:
        if exclude_request_content_id:
            query = """
                SELECT 
                    rc.id as request_content_id,
                    rc.context,
                    rc.created_at
                FROM request_contents rc
                WHERE rc.request_id = %s
                  AND rc.id != %s
                  AND rc.context IS NOT NULL
                ORDER BY rc.created_at ASC
            """
            results = db.execute_query(query, (request_id, exclude_request_content_id), fetch=True)
        else:
            query = """
                SELECT 
                    rc.id as request_content_id,
                    rc.context,
                    rc.created_at
                FROM request_contents rc
                WHERE rc.request_id = %s
                  AND rc.context IS NOT NULL
                ORDER BY rc.created_at ASC
            """
            results = db.execute_query(query, (request_id,), fetch=True)
        
        if not results or len(results) == 0:
            return []
        
        request_contents_with_conversations = []
        
        for row in results:
            request_content_id = row['request_content_id']
            context = row.get('context', '') or ''
            
            if not context:
                continue
            
            room_query = """
                SELECT id
                FROM rooms
                WHERE request_id = %s
                  AND request_content_id = %s
                  AND chat_type = 'hearing'
                  AND is_deleted = false
                ORDER BY created_at ASC
                LIMIT 1
            """
            room_results = db.execute_query(room_query, (request_id, request_content_id), fetch=True)
            
            room_id = None
            conversations = []
            
            if room_results and len(room_results) > 0:
                room_id = room_results[0]['id']
                conversations = get_hearing_conversations_for_room(db, room_id)
            
            request_contents_with_conversations.append({
                'request_content_id': request_content_id,
                'context': context,
                'room_id': room_id,
                'conversations': conversations,
                'created_at': row.get('created_at')
            })
        
        return request_contents_with_conversations

    except Exception as e:
        logger.error(f"Error fetching request_contents with conversations: {e}", exc_info=True)
        return []

def get_request_content_context_by_room_id(db: DatabaseConnection, room_id: str, request_id: str) -> Optional[str]:
    try:
        query = """
            SELECT rc.context
            FROM request_contents rc
            INNER JOIN rooms r ON r.request_content_id = rc.id
            WHERE r.id = %s
              AND rc.request_id = %s
              AND rc.context IS NOT NULL
            ORDER BY rc.created_at DESC
            LIMIT 1
        """
        
        results = db.execute_query(query, (room_id, request_id), fetch=True)
        
        if not results or len(results) == 0:
            return None
        
        context = results[0].get('context', '') or ''
        return context if context else None

    except Exception as e:
        logger.error(f"Error fetching request_content context by room_id: {e}")
        return None


def get_request_content_comment(db: DatabaseConnection, request_content_id: int) -> Optional[str]:
    try:
        query = """
            SELECT comment
            FROM request_contents
            WHERE id = %s
            LIMIT 1
        """

        results = db.execute_query(query, (request_content_id,), fetch=True)

        if not results or len(results) == 0:
            return None

        comment = results[0].get('comment', '') or ''
        return comment if comment else None

    except Exception as e:
        logger.error(f"Error fetching request_content comment: {e}")
        return None

def get_previous_request_content_context(db: DatabaseConnection, request_id: int, exclude_request_content_id: Optional[int] = None) -> Optional[str]:
    try:
        if exclude_request_content_id:
            query = """
                SELECT context
                FROM request_contents
                WHERE request_id = %s
                  AND id != %s
                  AND context IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            """
            results = db.execute_query(query, (request_id, exclude_request_content_id), fetch=True)
        else:
            query = """
                SELECT context
                FROM request_contents
                WHERE request_id = %s
                  AND context IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            """
            results = db.execute_query(query, (request_id,), fetch=True)
        
        if not results or len(results) == 0:
            return None
        
        context = results[0].get('context', '') or ''
        return context if context else None

    except Exception as e:
        logger.error(f"Error fetching previous request_content context: {e}")
        return None

def create_or_update_request_content(db: DatabaseConnection, request_id: int, context: str, request_content_id: Optional[int] = None) -> Optional[int]:
    try:
        if request_content_id:
            query = """
                UPDATE request_contents
                SET context = %s, updated_at = NOW()
                WHERE id = %s AND request_id = %s
                RETURNING id
            """
            results = db.execute_query(query, (context, request_content_id, request_id), fetch=True)

            if results and len(results) > 0:
                return request_content_id
            else:
                logger.warning(f"Request content {request_content_id} not found, creating new one")
                request_content_id = None

        if not request_content_id:
            query = """
                INSERT INTO request_contents (request_id, context, created_at, updated_at)
                VALUES (%s, %s, NOW(), NOW())
                RETURNING id
            """
            results = db.execute_query(query, (request_id, context), fetch=True)

            if results and len(results) > 0:
                new_id = results[0]['id']
                return new_id

        return None
    except Exception as e:
        logger.error(f"Error creating/updating request_content: {e}", exc_info=True)
        return None

def get_topic_data_by_id(topic_id: str) -> Optional[Dict[str, Any]]:
    db = DatabaseConnection()
    try:
        db.connect()
        query = """
            SELECT id, name, description
            FROM topics
            WHERE id = %s AND deleted_at IS NULL
            LIMIT 1
        """
        results = db.execute_query(query, (topic_id,), fetch=True)

        if not results or len(results) == 0:
            logger.warning(f"Topic not found: {topic_id}")
            return None

        row = results[0]
        return {
            'id': row['id'],
            'name': row.get('name', '') or '',
            'description': row.get('description', '') or ''
        }
    except Exception as e:
        logger.error(f"Error fetching topic data: {e}")
        return None
    finally:
        db.close()


def get_topic_requests_data(topic_id: str) -> List[Dict[str, Any]]:
    db = DatabaseConnection()
    try:
        db.connect()
        query = """
            SELECT id, name, description, chart_path
            FROM requests
            WHERE topic_id = %s AND deleted_at IS NULL
        """
        results = db.execute_query(query, (topic_id,), fetch=True)
        return [
            {
                'id': row['id'],
                'name': row['name'] or '',
                'description': row['description'] or '',
                'chart_path': row['chart_path']
            }
            for row in results
        ] if results else []
    except Exception as e:
        logger.error(f"Error fetching topic requests data: {e}")
        return []
    finally:
        db.close()


def update_request_document_parsed(
    db: DatabaseConnection,
    document_id: str,
    parsed_document_key: str,
    token_count: int
) -> bool:
    try:
        query = """
            UPDATE request_documents
            SET parsed_document_key = %s, token_count = %s, updated_at = NOW()
            WHERE id = %s
        """
        db.execute_query(query, (parsed_document_key, token_count, document_id))
        logger.debug(f"Document {document_id} parsed fields updated")
        return True
    except Exception as e:
        logger.error(f"Error updating request_document parsed fields: {e}")
        return False


def get_request_documents_by_ids(
    db: DatabaseConnection,
    document_ids: List[str]
) -> List[Dict[str, Any]]:
    if not document_ids:
        return []
    try:
        placeholders = ','.join(['%s'] * len(document_ids))
        query = f"""
            SELECT id, request_id, key, parsed_document_key, token_count, status, file_type
            FROM request_documents
            WHERE id IN ({placeholders})
        """
        results = db.execute_query(query, tuple(document_ids), fetch=True)
        return [dict(row) for row in results] if results else []
    except Exception as e:
        logger.error(f"Error getting request_documents by ids: {e}")
        return []


def get_latest_request_content_id(db: DatabaseConnection, request_id: str) -> Optional[str]:
    try:
        query = """
            SELECT id
            FROM request_contents
            WHERE request_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """
        results = db.execute_query(query, (request_id,), fetch=True)
        if results and len(results) > 0:
            return results[0]['id']
        return None
    except Exception as e:
        logger.error(f"Error getting latest request_content_id: {e}")
        return None


def get_hearing_qa_by_request_id(db: DatabaseConnection, request_id: str) -> List[Dict[str, Any]]:
    try:
        query = """
            SELECT
                text as question,
                metadata_->>'keyword_category' as keyword_category,
                metadata_->>'question_intent' as question_intent,
                metadata_->>'related_situation' as related_situation,
                metadata_->>'answer' as answer
            FROM data_knowledge_hearing_qa
            WHERE metadata_->>'request_id' = %s
            ORDER BY (metadata_->>'row_index')::int
        """
        results = db.execute_query(query, (request_id,), fetch=True)

        if not results:
            return []

        return [
            {
                'question': row['question'] or '',
                'keyword_category': row['keyword_category'] or '',
                'question_intent': row['question_intent'] or '',
                'related_situation': row['related_situation'] or '',
                'answer': row['answer'] or ''
            }
            for row in results
        ]
    except Exception as e:
        logger.debug(f"Error getting hearing QA rows (table may not exist): {e}")
        return []


def save_transcriptions(
    db: DatabaseConnection,
    manual_id: str,
    segments: List[Dict[str, Any]],
    request_document_id: Optional[str] = None,
) -> bool:
    try:
        if request_document_id:
            delete_query = """
                DELETE FROM transcriptions
                WHERE manual_id = %s AND request_document_id = %s
            """
            db.execute_query(delete_query, (manual_id, request_document_id))
        else:
            delete_query = """
                DELETE FROM transcriptions
                WHERE manual_id = %s
            """
            db.execute_query(delete_query, (manual_id,))

        if not segments:
            logger.info(f"No segments to save for manual {manual_id}")
            return True

        insert_query = """
            INSERT INTO transcriptions (id, manual_id, request_document_id, sequence, start_second, end_second, text, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """

        for idx, seg in enumerate(segments):
            transcription_id = str(ULID())
            db.execute_query(insert_query, (
                transcription_id,
                manual_id,
                request_document_id,
                idx + 1,
                seg.get('start', 0),
                seg.get('end', 0),
                seg.get('text', ''),
            ))

        logger.info(f"Saved {len(segments)} transcriptions for manual {manual_id}")
        return True

    except Exception as e:
        logger.error(f"Error saving transcriptions: {e}", exc_info=True)
        return False


def save_chapters(
    db: DatabaseConnection,
    manual_id: str,
    chapters: List[Dict[str, Any]],
    request_document_id: Optional[str] = None,
) -> bool:
    try:
        if request_document_id:
            delete_query = """
                DELETE FROM chapters
                WHERE manual_id = %s AND request_document_id = %s
            """
            db.execute_query(delete_query, (manual_id, request_document_id))
        else:
            delete_query = """
                DELETE FROM chapters
                WHERE manual_id = %s
            """
            db.execute_query(delete_query, (manual_id,))

        if not chapters:
            logger.info(f"No chapters to save for manual {manual_id}")
            return True

        insert_query = """
            INSERT INTO chapters (id, manual_id, request_document_id, sequence, start_second, end_second, title, description, thumbnail_path, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """

        for chapter in chapters:
            chapter_id = str(ULID())
            db.execute_query(insert_query, (
                chapter_id,
                manual_id,
                request_document_id,
                chapter.get('sequence', 1),
                chapter.get('start_second', 0),
                chapter.get('end_second', 0),
                chapter.get('title', ''),
                chapter.get('description', ''),
                chapter.get('thumbnail_path'),
            ))

        logger.info(f"Saved {len(chapters)} chapters for manual {manual_id}")
        return True

    except Exception as e:
        logger.error(f"Error saving chapters: {e}", exc_info=True)
        return False


def update_manual_video_keys(
    db: DatabaseConnection,
    manual_id: str,
    input_video_key: Optional[str] = None,
    hls_video_key: Optional[str] = None,
) -> bool:
    try:
        updates = []
        params = []

        if input_video_key is not None:
            updates.append("input_video_key = %s")
            params.append(input_video_key)

        if hls_video_key is not None:
            updates.append("hls_video_key = %s")
            params.append(hls_video_key)

        if not updates:
            return True

        updates.append("updated_at = NOW()")
        params.append(manual_id)

        query = f"""
            UPDATE manuals
            SET {', '.join(updates)}
            WHERE id = %s
        """
        db.execute_query(query, tuple(params))
        logger.info(f"Updated video keys for manual {manual_id}")
        return True

    except Exception as e:
        logger.error(f"Error updating manual video keys: {e}", exc_info=True)
        return False


def update_manual_video_id(
    db: DatabaseConnection,
    manual_id: str,
    video_id: str,
) -> bool:
    try:
        query = """
            UPDATE manuals
            SET video_id = %s, updated_at = NOW()
            WHERE id = %s
        """
        db.execute_query(query, (video_id, manual_id))
        logger.info(f"Updated video_id for manual {manual_id}: {video_id}")
        return True

    except Exception as e:
        logger.error(f"Error updating manual video_id: {e}", exc_info=True)
        return False


def get_manual_by_request_id(
    db: DatabaseConnection,
    request_id: str,
) -> Optional[Dict[str, Any]]:
    try:
        query = """
            SELECT id, topic_id, request_id, body, input_text, manual_template_id
            FROM manuals
            WHERE request_id = %s
            LIMIT 1
        """
        results = db.execute_query(query, (request_id,), fetch=True)
        if results and len(results) > 0:
            return dict(results[0])
        return None
    except Exception as e:
        logger.error(f"Error getting manual by request_id: {e}")
        return None


def get_manual_template(
    db: DatabaseConnection,
    template_id: str,
) -> Optional[Dict[str, Any]]:
    """テンプレート情報を取得する"""
    try:
        query = """
            SELECT id, name, description, sections, generation_prompt, output_format
            FROM manual_templates
            WHERE id = %s
            LIMIT 1
        """
        results = db.execute_query(query, (template_id,), fetch=True)
        if results and len(results) > 0:
            return dict(results[0])
        return None
    except Exception as e:
        logger.error(f"Error getting manual template: {e}")
        return None


def update_manual_body(
    db: DatabaseConnection,
    manual_id: str,
    body: str,
) -> bool:
    try:
        query = """
            UPDATE manuals
            SET body = %s, updated_at = NOW()
            WHERE id = %s
        """
        db.execute_query(query, (body, manual_id))
        logger.info(f"Manual {manual_id} body updated")
        return True
    except Exception as e:
        logger.error(f"Error updating manual body: {e}")
        return False
