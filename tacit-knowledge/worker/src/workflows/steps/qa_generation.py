import asyncio
import json
import logging
from typing import List, Dict, Any, Optional

from llama_index.core import Document
from llama_index.core.llms import ChatMessage
from llama_index.core.prompts import ChatPromptTemplate
from llama_index.llms.openai import OpenAI

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    get_request_contents_with_conversations,
    get_request_content,
    KnowledgeQaRow,
    KnowledgeQaResponse,
    load_prompts,
    create_knowledge_hearing_qa_vector_store,
    get_embed_model,
    index_documents_to_vector_store,
    get_llm,
)

PROMPTS = load_prompts()


def _delete_existing_qa_by_request_id(request_id: str):
    db = DatabaseConnection()
    db.connect()
    try:
        db.execute_query(
            "DELETE FROM data_knowledge_hearing_qa WHERE metadata_->>'request_id' = %s",
            (request_id,)
        )
    except Exception as e:
        logger.debug(f"Table may not exist yet or delete failed: {e}")
    finally:
        db.close()


def _get_existing_qa_rows(request_id: str) -> List[KnowledgeQaRow]:
    db = DatabaseConnection()
    try:
        db.connect()
        results = db.execute_query(
            """
            SELECT
                text as question,
                metadata_->>'keyword_category' as keyword_category,
                metadata_->>'question_intent' as question_intent,
                metadata_->>'related_situation' as related_situation,
                metadata_->>'answer' as answer
            FROM data_knowledge_hearing_qa
            WHERE metadata_->>'request_id' = %s
            ORDER BY (metadata_->>'row_index')::int
            """,
            (request_id,),
            fetch=True
        )

        if not results:
            return []

        return [
            KnowledgeQaRow(
                question=row['question'] or '',
                keyword_category=row['keyword_category'] or '',
                question_intent=row['question_intent'] or '',
                related_situation=row['related_situation'] or '',
                answer=row['answer'] or ''
            )
            for row in results
        ]
    except Exception as e:
        logger.debug(f"Error getting existing QA rows (table may not exist): {e}")
        return []
    finally:
        db.close()


def _get_qa_pairs_from_database(
    db: DatabaseConnection,
    request_id: str,
    request_content_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    qa_pairs: List[Dict[str, Any]] = []

    try:
        request_contents_data = get_request_contents_with_conversations(
            db, request_id, exclude_request_content_id=None
        )

        if not request_contents_data:
            logger.warning(f"No request_contents found for request_id: {request_id}")
            return []

        for rc_data in request_contents_data:
            request_content_id_item = rc_data.get('request_content_id')
            if request_content_id and request_content_id_item != request_content_id:
                continue

            context = rc_data.get('context', '')
            conversations = rc_data.get('conversations', [])
            room_id = rc_data.get('room_id')

            request_content_info = None
            if request_content_id_item:
                request_content_info = get_request_content(db, request_content_id_item)

            for conv in conversations:
                question = conv.get('question', '').strip()
                answer = conv.get('answer', '').strip()

                if question and answer:
                    qa_pair: Dict[str, Any] = {
                        'question': question,
                        'answer': answer,
                        'request_content_id': request_content_id_item,
                        'context': context,
                        'room_id': room_id,
                    }

                    if request_content_info:
                        qa_pair['request_content'] = {
                            'id': request_content_info.get('id'),
                            'created_at': request_content_info.get('created_at'),
                            'updated_at': request_content_info.get('updated_at'),
                        }

                    qa_pairs.append(qa_pair)

        return qa_pairs

    except Exception as e:
        logger.error(f"Error getting QA pairs from database: {e}", exc_info=True)
        return []


def _format_qa_pairs_for_prompt(qa_pairs: List[Dict[str, Any]]) -> str:
    formatted_pairs: List[str] = []

    for idx, qa in enumerate(qa_pairs, 1):
        question = qa.get('question', '')
        answer = qa.get('answer', '')
        context = qa.get('context', '')
        request_content_id = qa.get('request_content_id')

        formatted_text = f"**質問{idx}**: {question}\n**回答{idx}**: {answer}"

        if context:
            formatted_text += f"\n**コンテキスト{idx}**: {context[:200]}..." if len(context) > 200 else f"\n**コンテキスト{idx}**: {context}"

        if request_content_id:
            formatted_text += f"\n**Request Content ID{idx}**: {request_content_id}"

        formatted_pairs.append(formatted_text)

    return "\n\n".join(formatted_pairs)


def _format_qa_rows_for_prompt(qa_rows: List[KnowledgeQaRow]) -> str:
    formatted_rows: List[str] = []

    for idx, row in enumerate(qa_rows, 1):
        formatted_text = (
            f"**行{idx}**:\n"
            f"  - 質問: {row.question}\n"
            f"  - 条件1: キーワード/カテゴリ: {row.keyword_category}\n"
            f"  - 条件2: 質問の意図: {row.question_intent}\n"
            f"  - 条件3: 関連する状況: {row.related_situation}\n"
            f"  - 回答: {row.answer}"
        )
        formatted_rows.append(formatted_text)

    return "\n\n".join(formatted_rows)


def _generate_qa_with_openai(
    llm: OpenAI,
    qa_pairs: List[Dict[str, Any]]
) -> Optional[KnowledgeQaResponse]:
    try:
        if not qa_pairs:
            logger.warning("No question-answer pairs provided")
            return None

        generation_prompts = PROMPTS.get('qa_optimization', {}).get('generation', {})
        prompt_template = generation_prompts.get('prompt', '')
        if not prompt_template:
            logger.warning("qa_optimization.generation.prompt not found")
            return None

        qa_pairs_text = _format_qa_pairs_for_prompt(qa_pairs)

        response_schema = KnowledgeQaResponse.model_json_schema()

        schema_description_template = generation_prompts.get('schema_description', '')
        if not schema_description_template:
            logger.warning("qa_optimization.generation.schema_description not found")
            return None

        schema_description = schema_description_template.format(
            response_schema=json.dumps(response_schema, ensure_ascii=False, indent=2)
        )

        prompt = prompt_template.format(
            qa_pairs=qa_pairs_text,
            schema_description=schema_description
        )

        chat_prompt_tmpl = ChatPromptTemplate(
            message_templates=[
                ChatMessage.from_str(prompt, role="user"),
            ]
        )

        qa_response = llm.structured_predict(
            KnowledgeQaResponse,
            chat_prompt_tmpl,
        )

        if qa_response and qa_response.rows:
            return qa_response

        logger.warning("Failed to generate QA: empty rows")
        return None

    except Exception as e:
        logger.error(f"Error generating QA with OpenAI: {e}", exc_info=True)
        return None


def _update_qa_with_openai(
    llm: OpenAI,
    existing_qa_rows: List[KnowledgeQaRow],
    new_qa_pairs: List[Dict[str, Any]]
) -> Optional[KnowledgeQaResponse]:
    try:
        if not new_qa_pairs:
            logger.warning("No new question-answer pairs provided")
            return None

        update_prompts = PROMPTS.get('qa_optimization', {}).get('update', {})
        prompt_template = update_prompts.get('prompt', '')
        if not prompt_template:
            logger.warning("qa_optimization.update.prompt not found")
            return None

        existing_qa_rows_text = _format_qa_rows_for_prompt(existing_qa_rows)
        new_qa_pairs_text = _format_qa_pairs_for_prompt(new_qa_pairs)

        response_schema = KnowledgeQaResponse.model_json_schema()

        schema_description_template = update_prompts.get('schema_description', '')
        if not schema_description_template:
            logger.warning("qa_optimization.update.schema_description not found")
            return None

        schema_description = schema_description_template.format(
            response_schema=json.dumps(response_schema, ensure_ascii=False, indent=2)
        )

        prompt = prompt_template.format(
            existing_chart_rows=existing_qa_rows_text,
            new_qa_pairs=new_qa_pairs_text,
            schema_description=schema_description
        )

        chat_prompt_tmpl = ChatPromptTemplate(
            message_templates=[
                ChatMessage.from_str(prompt, role="user"),
            ]
        )

        qa_response = llm.structured_predict(
            KnowledgeQaResponse,
            chat_prompt_tmpl,
        )

        if qa_response and qa_response.rows:
            return qa_response

        logger.warning("Failed to update QA: empty rows")
        return None

    except Exception as e:
        logger.error(f"Error updating QA with OpenAI: {e}", exc_info=True)
        return None


def _save_qa_to_vector_store(
    request_id: str,
    qa_rows: List[KnowledgeQaRow]
) -> bool:
    try:
        if not qa_rows:
            logger.warning("No QA rows to save")
            return False

        _delete_existing_qa_by_request_id(request_id)

        vector_store = create_knowledge_hearing_qa_vector_store()
        embed_model = get_embed_model()

        documents = []
        for idx, row in enumerate(qa_rows):
            doc = Document(
                text=row.question,
                metadata={
                    "request_id": request_id,
                    "row_index": idx,
                    "keyword_category": row.keyword_category,
                    "question_intent": row.question_intent,
                    "related_situation": row.related_situation,
                    "answer": row.answer,
                }
            )
            documents.append(doc)

        index_documents_to_vector_store(
            documents=documents,
            vector_store=vector_store,
            embed_model=embed_model,
            use_chunking=False,
        )

        logger.info(f"Saved {len(documents)} QA rows for request {request_id}")
        return True

    except Exception as e:
        logger.error(f"Error saving QA to vector store: {e}", exc_info=True)
        return False


async def generate_qa_step(
    db: DatabaseConnection,
    request_id: str,
    request_content_id: Optional[str],
) -> bool:
    logger.info("[START] QA generation step")

    llm = get_llm()

    existing_qa_rows = await asyncio.to_thread(
        _get_existing_qa_rows, request_id
    )

    qa_response = None

    if existing_qa_rows:
        if request_content_id:
            new_qa_pairs = await asyncio.to_thread(
                _get_qa_pairs_from_database, db, request_id, request_content_id
            )

            if not new_qa_pairs:
                logger.warning("No new question-answer pairs found, keeping existing QA")
                return True

            qa_response = await asyncio.to_thread(
                _update_qa_with_openai, llm, existing_qa_rows, new_qa_pairs
            )
            if not qa_response:
                logger.error("Failed to update QA, keeping existing data")
                return False
        else:
            existing_qa_rows = []

    if not existing_qa_rows:
        qa_pairs = await asyncio.to_thread(
            _get_qa_pairs_from_database, db, request_id, request_content_id
        )
        if not qa_pairs:
            logger.warning("No question-answer pairs found in database")
            return True

        qa_response = await asyncio.to_thread(
            _generate_qa_with_openai, llm, qa_pairs
        )
        if not qa_response:
            logger.error("Failed to generate QA")
            return False

    if qa_response:
        success = await asyncio.to_thread(
            _save_qa_to_vector_store, request_id, qa_response.rows
        )
        logger.info("[DONE] QA generation step")
        return success

    logger.info("[DONE] QA generation step (no response)")
    return False
