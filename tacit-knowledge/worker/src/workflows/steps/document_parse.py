import asyncio
import json
import os
import logging
import tempfile
import tiktoken
from typing import List, Optional, Dict

from llama_index.core.llms import ChatMessage
from llama_index.core.prompts import ChatPromptTemplate
from llama_index.llms.openai import OpenAI

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    update_document_status,
    update_request_document_parsed,
    get_request_documents_by_ids,
    process_document_file,
    process_video_file,
    download_s3_directory,
    upload_parsed_document,
    upload_binary_file_to_s3,
    is_video_file,
    is_audio_file,
    save_transcriptions,
    save_chapters,
    update_manual_video_id,
    load_prompts,
    ChapterResponse,
    extract_thumbnail_from_video,
    get_llm,
)
from ...utils.media import transcribe_audio_with_timestamps

TIKTOKEN_ENCODER = tiktoken.encoding_for_model("gpt-4")
PROMPTS = load_prompts()


def _generate_chapters_with_llm(
    llm: OpenAI,
    transcription_text: str,
) -> Optional[ChapterResponse]:
    try:
        chapter_prompts = PROMPTS.get('manual', {}).get('chapter_generation', {})
        prompt_template = chapter_prompts.get('prompt', '')
        if not prompt_template:
            logger.warning("manual.chapter_generation.prompt not found")
            return None

        response_schema = ChapterResponse.model_json_schema()

        schema_description_template = chapter_prompts.get('schema_description', '')
        if not schema_description_template:
            logger.warning("manual.chapter_generation.schema_description not found")
            return None

        schema_description = schema_description_template.format(
            response_schema=json.dumps(response_schema, ensure_ascii=False, indent=2)
        )

        prompt = prompt_template.format(
            transcription_text=transcription_text,
            schema_description=schema_description
        )

        chat_prompt_tmpl = ChatPromptTemplate(
            message_templates=[
                ChatMessage.from_str(prompt, role="user"),
            ]
        )

        chapter_response = llm.structured_predict(
            ChapterResponse,
            chat_prompt_tmpl,
        )

        if chapter_response and chapter_response.chapters:
            return chapter_response

        logger.warning("Failed to generate chapters: empty response")
        return None

    except Exception as e:
        logger.error(f"Error generating chapters with LLM: {e}", exc_info=True)
        return None


async def _process_media_files(
    db: DatabaseConnection,
    media_doc_ids: List[str],
    manual_id: str,
    request_id: str,
    temp_dir: str,
    docs_by_id: Dict,
) -> Dict:
    result = {
        'transcription_text': '',
        'chapters_count': 0,
        'processed_doc_ids': [],
        'video_path': None,
        'video_doc_id': None,
    }

    if not media_doc_ids:
        return result

    logger.info(f"[START] Media processing ({len(media_doc_ids)} media files)")

    llm = get_llm()

    all_segments = []
    all_transcription_lines = []

    for doc_id in media_doc_ids:
        try:
            doc = docs_by_id.get(doc_id)
            if not doc:
                await asyncio.to_thread(update_document_status, db, doc_id, 'failed')
                continue

            original_key = doc.get('key', '')
            if not original_key:
                await asyncio.to_thread(update_document_status, db, doc_id, 'failed')
                continue

            filename = original_key.split('/')[-1]
            file_path = f"{temp_dir}/{filename}"
            file_type = doc.get('file_type')

            logger.info(f"[MEDIA] Processing: {filename}")

            if is_video_file(file_type, filename):
                media_result = await asyncio.to_thread(
                    process_video_file, file_path
                )
            else:
                media_result = await asyncio.to_thread(
                    transcribe_audio_with_timestamps, file_path
                )

            segments = media_result.get('segments', [])

            if segments:
                lines = [f"[Media Transcription: {filename}]"]
                for seg in segments:
                    start = seg.get('start', 0)
                    end = seg.get('end', 0)
                    text = seg.get('text', '')
                    lines.append(f"[{start:.1f} - {end:.1f}] {text}")
                parsed_text = "\n".join(lines)
                all_segments.extend(segments)
                all_transcription_lines.extend(lines)
            else:
                parsed_text = media_result.get('text', '')

            token_count = len(TIKTOKEN_ENCODER.encode(parsed_text))

            parsed_key = f"{original_key}.parsed.txt"
            await asyncio.to_thread(
                upload_parsed_document, parsed_key, parsed_text
            )

            local_parsed_path = f"{temp_dir}/{filename}.parsed.txt"
            with open(local_parsed_path, 'w', encoding='utf-8') as f:
                f.write(parsed_text)
            logger.info(f"[MEDIA] Saved local parsed file: {local_parsed_path}")

            await asyncio.to_thread(
                update_request_document_parsed,
                db, doc_id, parsed_key, token_count
            )

            await asyncio.to_thread(update_document_status, db, doc_id, 'completed')
            logger.info(f"Media {doc_id} processed: {token_count} tokens, {len(segments)} segments")
            result['processed_doc_ids'].append(doc_id)

        except Exception as e:
            logger.error(f"Error processing media {doc_id}: {e}", exc_info=True)
            await asyncio.to_thread(update_document_status, db, doc_id, 'failed')

    first_video_doc_id = None
    first_video_path = None
    for doc_id in media_doc_ids:
        doc = docs_by_id.get(doc_id)
        if doc:
            doc_file_type = doc.get('file_type')
            doc_filename = doc.get('key', '').split('/')[-1]
            if is_video_file(doc_file_type, doc_filename):
                first_video_doc_id = doc.get('id')
                first_video_path = f"{temp_dir}/{doc_filename}"
                break

    if all_segments and manual_id:
        await asyncio.to_thread(
            save_transcriptions, db, manual_id, all_segments, first_video_doc_id
        )
        logger.info(f"[MEDIA] Saved {len(all_segments)} transcriptions for manual {manual_id}")

        transcription_text = "\n".join(all_transcription_lines)
        result['transcription_text'] = transcription_text

        logger.info("[MEDIA] Generating chapters with LLM...")
        chapter_response = await asyncio.to_thread(
            _generate_chapters_with_llm, llm, transcription_text
        )

        if chapter_response and chapter_response.chapters:
            chapters_data = []
            for ch in chapter_response.chapters:
                chapter_dict = {
                    'sequence': ch.sequence,
                    'start_second': ch.start_second,
                    'end_second': ch.end_second,
                    'title': ch.title,
                    'description': ch.description,
                    'thumbnail_path': None,
                }

                if first_video_path and os.path.exists(first_video_path) and first_video_doc_id:
                    thumbnail_timestamp = ch.start_second + 1.0
                    thumbnail_filename = f"chapter_{ch.sequence}_thumbnail.jpg"
                    thumbnail_local_path = os.path.join(tempfile.gettempdir(), thumbnail_filename)

                    try:
                        success = await asyncio.to_thread(
                            extract_thumbnail_from_video,
                            first_video_path,
                            thumbnail_local_path,
                            thumbnail_timestamp
                        )

                        if success and os.path.exists(thumbnail_local_path):
                            thumbnail_s3_key = f"videos/thumbnails/{manual_id}/{first_video_doc_id}/{thumbnail_filename}"

                            await asyncio.to_thread(
                                upload_binary_file_to_s3,
                                thumbnail_local_path,
                                thumbnail_s3_key
                            )
                            chapter_dict['thumbnail_path'] = thumbnail_s3_key
                            logger.info(f"[MEDIA] Uploaded thumbnail for chapter {ch.sequence}: {thumbnail_s3_key}")

                            os.remove(thumbnail_local_path)
                    except Exception as e:
                        logger.warning(f"[MEDIA] Failed to generate thumbnail for chapter {ch.sequence}: {e}")

                chapters_data.append(chapter_dict)

            await asyncio.to_thread(
                save_chapters, db, manual_id, chapters_data, first_video_doc_id
            )
            result['chapters_count'] = len(chapters_data)
            logger.info(f"[MEDIA] Saved {len(chapters_data)} chapters for manual {manual_id}")

            if first_video_path and os.path.exists(first_video_path) and first_video_doc_id:
                result['video_path'] = first_video_path
                result['video_doc_id'] = first_video_doc_id

                await asyncio.to_thread(
                    update_manual_video_id, db, manual_id, first_video_doc_id
                )
                logger.info(f"[MEDIA] Updated manual.video_id to {first_video_doc_id}")
        else:
            logger.warning("[MEDIA] No chapters generated")

    logger.info(f"[DONE] Media processing (processed: {len(result['processed_doc_ids'])}, chapters: {result['chapters_count']})")
    return result


async def document_parse_step(
    db: DatabaseConnection,
    document_ids: List[str],
    request_id: str,
    topic_id: Optional[str],
    manual_id: Optional[str] = None,
) -> Dict:
    result = {
        'media_doc_ids': [],
        'parsed_doc_ids': [],
        'temp_dir': None,
        'video_path': None,
        'video_doc_id': None,
    }

    if not document_ids:
        return result

    logger.info(f"[START] Document parse step ({len(document_ids)} documents)")

    for doc_id in document_ids:
        await asyncio.to_thread(update_document_status, db, doc_id, 'processing')

    docs = await asyncio.to_thread(
        get_request_documents_by_ids, db, document_ids
    )
    if not docs:
        logger.warning("No documents found for the given IDs")
        return result

    first_key = docs[0].get('key', '')
    if not first_key:
        logger.error("Document has no S3 key")
        return result

    directory_path = os.path.dirname(first_key)

    temp_dir = await asyncio.to_thread(download_s3_directory, directory_path)

    if not temp_dir:
        logger.error("Failed to download S3 directory")
        return result

    result['temp_dir'] = temp_dir

    try:
        docs_by_id = {doc['id']: doc for doc in docs}
        media_doc_ids = []

        for doc_id in document_ids:
            try:
                doc = docs_by_id.get(doc_id)
                if not doc:
                    await asyncio.to_thread(update_document_status, db, doc_id, 'failed')
                    continue

                original_key = doc.get('key', '')
                if not original_key:
                    await asyncio.to_thread(update_document_status, db, doc_id, 'failed')
                    continue

                filename = original_key.split('/')[-1]
                file_path = f"{temp_dir}/{filename}"
                file_type = doc.get('file_type')

                if is_video_file(file_type, filename) or is_audio_file(file_type, filename):
                    logger.info(f"[MEDIA] Found media file: {filename}")
                    media_doc_ids.append(doc_id)
                    continue

                parsed_texts = await asyncio.to_thread(
                    process_document_file, file_path, file_type
                )
                parsed_text = "\n\n".join(parsed_texts) if parsed_texts else ""

                token_count = len(TIKTOKEN_ENCODER.encode(parsed_text))

                parsed_key = f"{original_key}.parsed.txt"
                await asyncio.to_thread(
                    upload_parsed_document, parsed_key, parsed_text
                )

                await asyncio.to_thread(
                    update_request_document_parsed,
                    db, doc_id, parsed_key, token_count
                )

                await asyncio.to_thread(update_document_status, db, doc_id, 'completed')
                logger.info(f"Document {doc_id} parsed: {token_count} tokens")
                result['parsed_doc_ids'].append(doc_id)

            except Exception as e:
                logger.error(f"Error parsing document {doc_id}: {e}", exc_info=True)
                await asyncio.to_thread(update_document_status, db, doc_id, 'failed')

        result['media_doc_ids'] = media_doc_ids

        if media_doc_ids and manual_id:
            media_result = await _process_media_files(
                db=db,
                media_doc_ids=media_doc_ids,
                manual_id=manual_id,
                request_id=request_id,
                temp_dir=temp_dir,
                docs_by_id=docs_by_id,
            )
            result['parsed_doc_ids'].extend(media_result.get('processed_doc_ids', []))
            result['video_path'] = media_result.get('video_path')
            result['video_doc_id'] = media_result.get('video_doc_id')

        logger.info(f"[DONE] Document parse step (parsed: {len(result['parsed_doc_ids'])}, media: {len(media_doc_ids)})")
        return result

    except Exception as e:
        logger.error(f"Error in document_parse_step: {e}", exc_info=True)
        for doc_id in document_ids:
            if doc_id not in result['parsed_doc_ids'] and doc_id not in result['media_doc_ids']:
                await asyncio.to_thread(update_document_status, db, doc_id, 'failed')
        return result
