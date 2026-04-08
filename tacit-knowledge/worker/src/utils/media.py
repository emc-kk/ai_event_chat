import os
import subprocess
import tempfile
import shutil
import logging
from typing import Dict

logger = logging.getLogger(__name__)

from .llm import get_openai_client


def extract_audio_from_video(video_path: str, output_audio_path: str) -> bool:
    try:
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vn',
            '-acodec', 'libmp3lame',
            '-q:a', '2',
            '-y',
            output_audio_path
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            logger.warning(f"ffmpeg error: {result.stderr}")
            return False

        return os.path.exists(output_audio_path)

    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg timeout")
        return False
    except Exception as e:
        logger.warning(f"Error extracting audio: {str(e)}", exc_info=True)
        return False


def extract_thumbnail_from_video(video_path: str, output_image_path: str, timestamp_seconds: float) -> bool:
    try:
        cmd = [
            'ffmpeg',
            '-ss', str(timestamp_seconds),
            '-i', video_path,
            '-vframes', '1',
            '-q:v', '2',
            '-y',
            output_image_path
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            logger.warning(f"ffmpeg thumbnail error: {result.stderr}")
            return False

        return os.path.exists(output_image_path)

    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg thumbnail timeout")
        return False
    except Exception as e:
        logger.warning(f"Error extracting thumbnail: {str(e)}", exc_info=True)
        return False


def transcribe_audio_with_timestamps(audio_path: str) -> dict:
    try:
        client = get_openai_client()

        with open(audio_path, 'rb') as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        segments = []
        if hasattr(response, 'segments') and response.segments:
            for seg in response.segments:
                segments.append({
                    'start': float(getattr(seg, 'start', 0)),
                    'end': float(getattr(seg, 'end', 0)),
                    'text': getattr(seg, 'text', '').strip(),
                })

        full_text = response.text if hasattr(response, 'text') else ""

        return {
            'text': full_text,
            'segments': segments,
        }

    except Exception as e:
        logger.warning(f"Error transcribing audio: {str(e)}", exc_info=True)
        return {'text': '', 'segments': []}


def encode_video_to_h264(input_path: str, output_path: str) -> bool:
    try:
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-y',
            output_path
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=1800
        )

        if result.returncode != 0:
            logger.warning(f"ffmpeg H.264 encode error: {result.stderr}")
            return False

        return os.path.exists(output_path)

    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg H.264 encode timeout")
        return False
    except Exception as e:
        logger.warning(f"Error encoding video to H.264: {str(e)}", exc_info=True)
        return False


def generate_hls(input_path: str, output_dir: str) -> bool:
    try:
        os.makedirs(output_dir, exist_ok=True)
        output_playlist = os.path.join(output_dir, "output.m3u8")

        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-hls_time', '10',
            '-hls_list_size', '0',
            '-hls_segment_filename', os.path.join(output_dir, 'segment_%03d.ts'),
            '-y',
            output_playlist
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=1800
        )

        if result.returncode != 0:
            logger.warning(f"ffmpeg HLS generation error: {result.stderr}")
            return False

        return os.path.exists(output_playlist)

    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg HLS generation timeout")
        return False
    except Exception as e:
        logger.warning(f"Error generating HLS: {str(e)}", exc_info=True)
        return False


def encode_video_with_hls(input_path: str, mp4_output_path: str, hls_output_dir: str) -> Dict[str, bool]:
    try:
        os.makedirs(hls_output_dir, exist_ok=True)
        hls_playlist = os.path.join(hls_output_dir, "output.m3u8")
        hls_segment_pattern = os.path.join(hls_output_dir, "segment_%03d.ts")

        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-f', 'tee',
            '-map', '0:v',
            '-map', '0:a',
            (
                f"[movflags=+faststart]{mp4_output_path}|"
                f"[f=hls:hls_time=10:hls_list_size=0:hls_segment_filename={hls_segment_pattern}]{hls_playlist}"
            )
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=1800
        )

        if result.returncode != 0:
            logger.warning(f"ffmpeg tee encode error: {result.stderr}")
            return {'mp4': False, 'hls': False}

        mp4_success = os.path.exists(mp4_output_path)
        hls_success = os.path.exists(hls_playlist)

        return {'mp4': mp4_success, 'hls': hls_success}

    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg tee encode timeout")
        return {'mp4': False, 'hls': False}
    except Exception as e:
        logger.warning(f"Error encoding video with tee: {str(e)}", exc_info=True)
        return {'mp4': False, 'hls': False}


def process_video_file(video_path: str) -> dict:
    temp_dir = None
    try:
        filename = os.path.basename(video_path)
        temp_dir = tempfile.mkdtemp()
        audio_path = os.path.join(temp_dir, "audio.mp3")

        logger.info(f"[MEDIA] Extracting audio from: {filename}")

        if not extract_audio_from_video(video_path, audio_path):
            logger.warning(f"[MEDIA] Failed to extract audio from: {filename}")
            return {
                'text': f"[動画処理エラー: 音声抽出失敗 - {filename}]",
                'segments': [],
            }

        logger.info(f"[MEDIA] Audio extracted, transcribing...")

        result = transcribe_audio_with_timestamps(audio_path)

        if result['text']:
            logger.info(f"[MEDIA] Transcription completed: {len(result['text'])} characters, {len(result['segments'])} segments")
            logger.info(f"[MEDIA] Transcript preview: {result['text'][:500]}...")
            return {
                'text': f"[動画文字起こし: {filename}]\n{result['text']}",
                'segments': result['segments'],
            }
        else:
            logger.warning(f"[MEDIA] Transcription returned empty")
            return {
                'text': f"[動画処理エラー: 文字起こし失敗 - {filename}]",
                'segments': [],
            }

    except Exception as e:
        logger.warning(f"Error processing video: {str(e)}", exc_info=True)
        return {
            'text': f"[動画処理エラー: {os.path.basename(video_path)}]",
            'segments': [],
        }

    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
