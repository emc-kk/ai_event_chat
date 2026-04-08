import asyncio
import os
import shutil
import tempfile
import logging

logger = logging.getLogger(__name__)

from ...utils import (
    DatabaseConnection,
    upload_binary_file_to_s3,
    upload_directory_to_s3,
    update_manual_video_keys,
    encode_video_with_hls,
)


async def _process_video_encoding(
    db: DatabaseConnection,
    video_path: str,
    manual_id: str,
    video_doc_id: str,
) -> None:
    encode_temp_dir = None
    try:
        encode_temp_dir = tempfile.mkdtemp()

        logger.info(f"[MEDIA] Encoding video to H.264 + HLS simultaneously: {video_path}")
        mp4_output_path = os.path.join(encode_temp_dir, "h264_encoded.mp4")
        hls_output_dir = os.path.join(encode_temp_dir, "hls")

        encode_result = await asyncio.to_thread(
            encode_video_with_hls, video_path, mp4_output_path, hls_output_dir
        )

        input_video_key = None
        if encode_result['mp4'] and os.path.exists(mp4_output_path):
            input_video_key = f"videos/inputs/{manual_id}/{video_doc_id}/h264_encoded.mp4"
            await asyncio.to_thread(
                upload_binary_file_to_s3, mp4_output_path, input_video_key
            )
            logger.info(f"[MEDIA] Uploaded H.264 video: {input_video_key}")
        else:
            logger.warning("[MEDIA] Failed to encode video to H.264")

        hls_video_key = None
        if encode_result['hls'] and os.path.exists(os.path.join(hls_output_dir, "output.m3u8")):
            hls_s3_prefix = f"videos/hls/{manual_id}/{video_doc_id}"
            await asyncio.to_thread(
                upload_directory_to_s3, hls_output_dir, hls_s3_prefix
            )
            hls_video_key = f"{hls_s3_prefix}/output.m3u8"
            logger.info(f"[MEDIA] Uploaded HLS: {hls_video_key}")
        else:
            logger.warning("[MEDIA] Failed to generate HLS")

        if input_video_key or hls_video_key:
            await asyncio.to_thread(
                update_manual_video_keys,
                db, manual_id, input_video_key, hls_video_key
            )
            logger.info(f"[MEDIA] Updated manual video keys: input={input_video_key}, hls={hls_video_key}")

    except Exception as e:
        logger.error(f"[MEDIA] Error processing video encoding: {e}", exc_info=True)
    finally:
        if encode_temp_dir:
            shutil.rmtree(encode_temp_dir, ignore_errors=True)


async def video_encoding_step(
    db: DatabaseConnection,
    video_path: str,
    manual_id: str,
    video_doc_id: str,
) -> bool:
    if not video_path or not os.path.exists(video_path):
        logger.warning("[SKIP] Video encoding - no video path or file not found")
        return False

    if not manual_id or not video_doc_id:
        logger.warning("[SKIP] Video encoding - missing manual_id or video_doc_id")
        return False

    logger.info(f"[START] Video encoding step: {video_path}")

    await _process_video_encoding(db, video_path, manual_id, video_doc_id)

    logger.info("[DONE] Video encoding step")
    return True
