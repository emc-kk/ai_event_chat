import csv
import io
import logging
from typing import List
from llama_index.core import Document

from ..utils.database import DatabaseConnection
from ..utils.s3 import download_chart_csv
from ..utils.models import StarChartRow
from ..utils.indexing import (
    create_knowledge_hearing_qa_vector_store,
    get_embed_model,
    index_documents_to_vector_store,
)

logger = logging.getLogger(__name__)


def parse_chart_csv(csv_content: str) -> List[StarChartRow]:
    """Parse CSV content into StarChartRow objects."""
    rows = []
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            try:
                chart_row = StarChartRow(
                    question=row.get('質問（入力例）', '').strip(),
                    keyword_category=row.get('条件1: キーワード/カテゴリ', '').strip(),
                    question_intent=row.get('条件2: 質問の意図', '').strip(),
                    related_situation=row.get('条件3: 関連する状況', '').strip(),
                    answer=row.get('回答', '').strip()
                )
                rows.append(chart_row)
            except Exception as e:
                logger.warning(f"Error parsing chart row: {e}")
                continue
        return rows
    except Exception as e:
        logger.error(f"Error parsing CSV: {e}", exc_info=True)
        return []


def get_requests_with_qa_csv_path() -> List[dict]:
    db = DatabaseConnection()
    db.connect()
    result = db.execute_query(
        "SELECT id, chart_path FROM requests WHERE chart_path IS NOT NULL",
        fetch=True
    )
    db.close()
    return result if result else []


def delete_existing_qa_by_request_id(request_id: str):
    """Delete existing QA entries for a request_id. Silently handles table not existing."""
    db = DatabaseConnection()
    try:
        db.connect()
        db.execute_query(
            "DELETE FROM data_knowledge_hearing_qa WHERE metadata_->>'request_id' = %s",
            (request_id,)
        )
    except Exception as e:
        # Table may not exist yet, which is fine - it will be created when we add documents
        error_msg = str(e).lower()
        if "does not exist" in error_msg or "relation" in error_msg:
            logger.debug(f"Table does not exist yet for request {request_id}, will be created")
        else:
            logger.warning(f"Error deleting existing QA for request {request_id}: {e}")
    finally:
        db.close()


class CsvToQaMigrator:
    def __init__(self):
        self.vector_store = create_knowledge_hearing_qa_vector_store()
        self.embed_model = get_embed_model()

    def migrate_all_requests(self) -> dict:
        requests = get_requests_with_qa_csv_path()
        logger.info(f"Found {len(requests)} requests with chart_path")

        results = {"success": 0, "failed": 0, "skipped": 0}

        for req in requests:
            request_id = req["id"]
            csv_path = req["chart_path"]

            try:
                success = self.migrate_single_request(request_id, csv_path)
                if success:
                    results["success"] += 1
                else:
                    results["skipped"] += 1
            except Exception as e:
                logger.error(f"Failed to migrate request {request_id}: {e}")
                results["failed"] += 1

        logger.info(f"Migration completed: {results}")
        return results

    def migrate_single_request(self, request_id: str, csv_path: str) -> bool:
        logger.info(f"Migrating request {request_id} from {csv_path}")

        csv_content = download_chart_csv(csv_path)
        if not csv_content:
            logger.warning(f"Failed to download CSV for request {request_id}")
            return False

        rows = parse_chart_csv(csv_content)
        if not rows:
            logger.warning(f"No rows parsed from CSV for request {request_id}")
            return False

        try:
            delete_existing_qa_by_request_id(request_id)
        except Exception as e:
            logger.debug(f"Table may not exist yet: {e}")

        documents = []
        for idx, row in enumerate(rows):
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
            vector_store=self.vector_store,
            embed_model=self.embed_model,
            use_chunking=False,
        )

        logger.info(f"Migrated {len(documents)} rows for request {request_id}")
        return True


def run_migration():
    logging.basicConfig(level=logging.INFO)
    migrator = CsvToQaMigrator()
    return migrator.migrate_all_requests()


if __name__ == "__main__":
    run_migration()
