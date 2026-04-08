import logging
import os
import psycopg2

logger = logging.getLogger(__name__)


def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", 5432)),
        database=os.environ.get("POSTGRES_DB", "skillrelay"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
    )


def rename_llamaindex_to_knowledge_documents():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "ALTER TABLE IF EXISTS data_llamaindex RENAME TO data_knowledge_documents"
        )
        conn.commit()
        logger.info("Table renamed from data_llamaindex to data_knowledge_documents")
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to rename table: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def run_rename():
    logging.basicConfig(level=logging.INFO)
    return rename_llamaindex_to_knowledge_documents()


if __name__ == "__main__":
    run_rename()
