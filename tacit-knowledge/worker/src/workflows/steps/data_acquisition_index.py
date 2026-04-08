import asyncio
import logging
import os
import tempfile
from typing import List, Optional

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    process_directory_indexing,
)
import tiktoken

from ...utils.s3 import download_file_from_s3_with_fallback, upload_parsed_document
from ...utils.file import process_document_file

TIKTOKEN_ENCODER = tiktoken.encoding_for_model("gpt-4")


def get_datasource_files_by_ids(db: DatabaseConnection, file_ids: List[str]) -> list:
    """data_source_files テーブルからファイル情報を取得"""
    if not file_ids:
        return []

    placeholders = ', '.join(['%s'] * len(file_ids))
    query = f"""
        SELECT id, company_id, folder_id, name, key, file_type, ai_status, parsed_doc_key
        FROM data_source_files
        WHERE id IN ({placeholders}) AND deleted_at IS NULL
    """
    return db.execute_query(query, file_ids, fetch=True)


def update_datasource_file_status(db: DatabaseConnection, file_id: str, status: int):
    """data_source_files の ai_status を更新"""
    db.execute_query(
        "UPDATE data_source_files SET ai_status = %s, updated_at = NOW() WHERE id = %s",
        [status, file_id]
    )


def update_datasource_file_parsed(db: DatabaseConnection, file_id: str, parsed_doc_key: str, token_count: int):
    """data_source_files の parsed_doc_key と token_count を更新"""
    try:
        db.execute_query(
            "UPDATE data_source_files SET parsed_doc_key = %s, token_count = %s, updated_at = NOW() WHERE id = %s",
            [parsed_doc_key, token_count, file_id]
        )
        logger.debug(f"DataSourceFile {file_id} parsed fields updated (tokens={token_count})")
    except Exception as e:
        logger.error(f"Error updating datasource_file parsed fields: {e}")


def update_legacy_topic_metadata(db: DatabaseConnection, file_id: str):
    """
    AI学習完了後、このファイルに紐づくトピックのmetadata_.topic_idを
    data_knowledge_documentsに反映する（レガシー互換）。
    topic_data_source_linksに登録済みのリンクから逆引きして更新する。
    """
    try:
        links = db.execute_query(
            "SELECT topic_id FROM topic_data_source_links WHERE data_source_file_id = %s",
            [file_id],
            fetch=True,
        )
        if not links:
            return

        for link in links:
            topic_id = link['topic_id']
            db.execute_query(
                """
                UPDATE data_knowledge_documents
                SET metadata_ = (metadata_::jsonb || jsonb_build_object('topic_id', %s::text))::json
                WHERE (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' = %s
                """,
                [topic_id, file_id],
            )
            logger.info(f"Updated legacy metadata_.topic_id={topic_id} for file={file_id}")
    except Exception as e:
        logger.warning(f"Failed to update legacy topic metadata for file {file_id}: {e}")


async def data_acquisition_index_step(
    db: DatabaseConnection,
    data_source_file_ids: List[str],
    company_id: str,
) -> bool:
    """データソースファイルをベクトルDBにインデックスする"""
    if not data_source_file_ids:
        return True

    logger.info(f"[START] DataAcquisition index step ({len(data_source_file_ids)} files)")

    files = await asyncio.to_thread(
        get_datasource_files_by_ids, db, data_source_file_ids
    )
    if not files:
        logger.warning("No datasource files found for the given IDs")
        return True

    for file_record in files:
        file_id = file_record['id']
        s3_key = file_record['key']
        file_name = file_record['name']

        # ステータスを processing に更新
        await asyncio.to_thread(update_datasource_file_status, db, file_id, 1)

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # S3 からダウンロード（CarrierWaveサニタイズ不一致時は自動フォールバック）
                local_path = await asyncio.to_thread(
                    download_file_from_s3_with_fallback, s3_key, temp_dir, db, file_id
                )

                if not local_path:
                    logger.warning(f"Failed to download file from S3: {s3_key}")
                    await asyncio.to_thread(update_datasource_file_status, db, file_id, 3)
                    continue

                # ダウンロード後の実際のファイル名でマッピングを作成
                # CarrierWaveがファイル名をサニタイズするため（例: ②→_）、
                # DB上の元ファイル名とディスク上のファイル名が異なる場合がある
                local_filename = os.path.basename(local_path)
                relative_path_to_document_id = {local_filename: file_id}
                if file_name != local_filename:
                    relative_path_to_document_id[file_name] = file_id
                    logger.info(f"Added both filename mappings: '{local_filename}' and '{file_name}' -> {file_id}")

                # ドキュメントをパースしてparsed_doc_keyを保存
                file_type = file_record.get('file_type', '') or os.path.splitext(local_filename)[1].lstrip('.')
                parsed_texts = await asyncio.to_thread(process_document_file, local_path, file_type)
                parsed_text = "\n\n".join(parsed_texts) if parsed_texts else ""
                if parsed_text.strip():
                    token_count = len(TIKTOKEN_ENCODER.encode(parsed_text))
                    parsed_key = f"{s3_key}.parsed.txt"
                    await asyncio.to_thread(upload_parsed_document, parsed_key, parsed_text)
                    await asyncio.to_thread(update_datasource_file_parsed, db, file_id, parsed_key, token_count)
                    logger.info(f"Saved parsed_doc_key for {file_name} (tokens={token_count})")

                # ベクトルインデックス作成
                await asyncio.to_thread(
                    process_directory_indexing,
                    temp_dir,
                    None,  # request_id (データソースの場合は None)
                    None,  # topic_id
                    relative_path_to_document_id,
                )

                # ステータスを completed に更新
                await asyncio.to_thread(update_datasource_file_status, db, file_id, 2)

                # レガシー: 既にトピックに紐づいている場合、metadata_.topic_idを更新
                await asyncio.to_thread(update_legacy_topic_metadata, db, file_id)

                logger.info(f"[DONE] Indexed datasource file: {file_name}")

        except Exception as e:
            logger.error(f"Error indexing datasource file {file_name}: {e}", exc_info=True)
            await asyncio.to_thread(update_datasource_file_status, db, file_id, 3)

    logger.info("[DONE] DataAcquisition index step")
    return True
