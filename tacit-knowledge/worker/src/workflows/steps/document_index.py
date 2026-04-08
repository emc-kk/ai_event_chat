import asyncio
import logging
from typing import List, Optional, Dict

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    get_request_documents_by_ids,
    process_directory_indexing,
)


async def document_index_step(
    db: DatabaseConnection,
    document_ids: List[str],
    request_id: str,
    topic_id: Optional[str],
    temp_dir: str,
) -> bool:
    if not document_ids:
        return True

    logger.info(f"[START] Document index step ({len(document_ids)} documents)")

    docs = await asyncio.to_thread(
        get_request_documents_by_ids, db, document_ids
    )
    if not docs:
        logger.warning("No documents found for the given IDs")
        return True

    relative_path_to_document_id = {}
    for doc in docs:
        original_key = doc.get('key', '')
        if original_key:
            filename = original_key.split('/')[-1]
            relative_path_to_document_id[filename] = doc['id']

    try:
        await asyncio.to_thread(
            process_directory_indexing,
            temp_dir, request_id, topic_id, relative_path_to_document_id
        )

        logger.info("[DONE] Document index step")
        return True

    except Exception as e:
        logger.error(f"Error in document_index_step: {e}", exc_info=True)
        return False
