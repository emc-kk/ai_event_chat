import os
import tempfile
import mimetypes
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from s3fs import S3FileSystem
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

from ..config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_ENDPOINT_URL,
    AWS_S3_BUCKET,
    AWS_REGION,
)


_IS_LAMBDA = bool(os.environ.get('AWS_LAMBDA_FUNCTION_NAME'))


def _s3_client_kwargs():
    """Build kwargs for boto3 S3 client. In Lambda, use default credential chain (IAM role)."""
    kwargs = {'region_name': AWS_REGION}
    if not _IS_LAMBDA and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        kwargs['aws_access_key_id'] = AWS_ACCESS_KEY_ID
        kwargs['aws_secret_access_key'] = AWS_SECRET_ACCESS_KEY
    if AWS_ENDPOINT_URL:
        kwargs['endpoint_url'] = AWS_ENDPOINT_URL
    return kwargs


def _s3_client():
    return boto3.client('s3', **_s3_client_kwargs())


_s3fs_kwargs = {
    'key': None if _IS_LAMBDA else (AWS_ACCESS_KEY_ID or None),
    'secret': None if _IS_LAMBDA else (AWS_SECRET_ACCESS_KEY or None),
    'anon': False,
}
if AWS_ENDPOINT_URL:
    _s3fs_kwargs['client_kwargs'] = {'endpoint_url': AWS_ENDPOINT_URL}

s3_fs = S3FileSystem(**_s3fs_kwargs)

def download_file_from_s3(s3_key: str, local_dir: str) -> Optional[str]:
    """S3から単一ファイルをダウンロードしてローカルパスを返す"""
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return None

        s3_client = _s3_client()

        filename = os.path.basename(s3_key)
        local_path = os.path.join(local_dir, filename)

        s3_client.download_file(AWS_S3_BUCKET, s3_key, local_path)
        logger.info(f"Downloaded file from S3: {s3_key} -> {local_path}")
        return local_path

    except ClientError as e:
        logger.error(f"AWS S3 error downloading file: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Error downloading file from S3: {e}", exc_info=True)
        return None


def sanitize_filename_like_carrierwave(filename: str) -> str:
    """CarrierWaveのファイル名サニタイズを再現する。
    Ruby: /[^\\p{Word}\\.\\-\\+]/ → '_'
    ②③① 等の丸数字やその他の特殊文字が _ に置換される。
    """
    import re
    return re.sub(r'[^\w.\-+]', '_', filename)


def download_file_from_s3_with_fallback(
    s3_key: str, local_dir: str, db=None, file_id: str = None
) -> Optional[str]:
    """S3からダウンロード。404の場合、CarrierWaveサニタイズ後のキーでリトライする。
    成功した場合、DBのキーも修正する。
    """
    # まず元のキーで試行
    local_path = download_file_from_s3(s3_key, local_dir)
    if local_path:
        return local_path

    # CarrierWaveサニタイズ後のキーで再試行
    if '/' in s3_key:
        dir_part, filename_part = s3_key.rsplit('/', 1)
        sanitized = sanitize_filename_like_carrierwave(filename_part)
        if sanitized != filename_part:
            sanitized_key = f"{dir_part}/{sanitized}"
            logger.info(f"Retrying with sanitized key: {s3_key} -> {sanitized_key}")
            local_path = download_file_from_s3(sanitized_key, local_dir)
            if local_path:
                # DBのキーを修正
                if db and file_id:
                    try:
                        db.execute_query(
                            "UPDATE data_source_files SET key = %s WHERE id = %s",
                            [sanitized_key, file_id]
                        )
                        logger.info(f"Fixed DB key: {s3_key} -> {sanitized_key}")
                    except Exception as e:
                        logger.warning(f"Failed to fix DB key for {file_id}: {e}")
                return local_path

    return None


def download_s3_directory(directory_path: str) -> Optional[str]:
    try:
        s3_full_path = f"{AWS_S3_BUCKET}/{directory_path}"
        temp_dir = tempfile.mkdtemp()

        files = s3_fs.find(s3_full_path)

        if not files:
            return temp_dir

        for s3_file in files:
            relative_path = s3_file.replace(s3_full_path, "").lstrip("/")
            if not relative_path:
                continue

            local_file_path = os.path.join(temp_dir, relative_path)
            os.makedirs(os.path.dirname(local_file_path), exist_ok=True)

            s3_file_path = s3_file if not s3_file.startswith("s3://") else s3_file.replace("s3://", "")
            s3_fs.get(s3_file_path, local_file_path)

        return temp_dir

    except Exception as e:
        logger.error(f"Error downloading from S3: {e}", exc_info=True)
        return None


def process_directory_files(temp_dir: str) -> List[Dict[str, Any]]:
    file_data_list = []

    try:
        for root, dirs, files in os.walk(temp_dir):
            for filename in files:
                file_path = os.path.join(root, filename)

                with open(file_path, 'rb') as f:
                    content = f.read()

                content_type, _ = mimetypes.guess_type(filename)
                if not content_type:
                    content_type = 'application/octet-stream'

                file_data = {
                    'filename': filename,
                    'content': content,
                    'content_type': content_type
                }

                file_data_list.append(file_data)

        return file_data_list

    except Exception as e:
        logger.error(f"Error processing directory files: {e}", exc_info=True)
        return []

def download_chart_csv(chart_path: str) -> Optional[str]:
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return None

        s3_client = _s3_client()

        response = s3_client.get_object(Bucket=AWS_S3_BUCKET, Key=chart_path)
        csv_content = response['Body'].read().decode('utf-8-sig')

        return csv_content

    except ClientError as e:
        logger.error(f"AWS S3 error downloading CSV: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Error downloading CSV from S3: {e}", exc_info=True)
        return None


def upload_file_to_s3(
    file_content: str,
    s3_key: str,
    content_type: str = 'text/csv; charset=utf-8',
    encoding: str = 'utf-8-sig'
) -> Optional[str]:
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return None

        s3_client = _s3_client()

        if encoding:
            file_bytes = file_content.encode(encoding)
        else:
            file_bytes = file_content.encode('utf-8')

        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            ContentEncoding='utf-8' if encoding == 'utf-8-sig' else encoding
        )

        return s3_key

    except ClientError as e:
        logger.error(f"AWS S3 error uploading file: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Error uploading file to S3: {e}", exc_info=True)
        return None


def upload_parsed_document(key: str, content: str) -> bool:
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return False

        s3_client = _s3_client()

        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=key,
            Body=content.encode('utf-8'),
            ContentType='text/plain; charset=utf-8'
        )
        logger.debug(f"Uploaded parsed document to S3: {key}")
        return True

    except ClientError as e:
        logger.error(f"AWS S3 error uploading parsed document: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Error uploading parsed document to S3: {e}", exc_info=True)
        return False


def upload_binary_file_to_s3(local_path: str, s3_key: str) -> bool:
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return False

        s3_client = _s3_client()

        content_type, _ = mimetypes.guess_type(local_path)
        if content_type is None:
            content_type = 'application/octet-stream'

        with open(local_path, 'rb') as f:
            s3_client.put_object(
                Bucket=AWS_S3_BUCKET,
                Key=s3_key,
                Body=f,
                ContentType=content_type
            )
        logger.debug(f"Uploaded binary file to S3: {s3_key}")
        return True

    except ClientError as e:
        logger.error(f"AWS S3 error uploading binary file: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Error uploading binary file to S3: {e}", exc_info=True)
        return False


def upload_directory_to_s3(local_dir: str, s3_prefix: str) -> bool:
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return False

        s3_client = _s3_client()

        for root, dirs, files in os.walk(local_dir):
            for filename in files:
                local_path = os.path.join(root, filename)
                relative_path = os.path.relpath(local_path, local_dir)
                s3_key = f"{s3_prefix}/{relative_path}"

                content_type, _ = mimetypes.guess_type(local_path)
                if content_type is None:
                    content_type = 'application/octet-stream'

                with open(local_path, 'rb') as f:
                    s3_client.put_object(
                        Bucket=AWS_S3_BUCKET,
                        Key=s3_key,
                        Body=f,
                        ContentType=content_type
                    )
                logger.debug(f"Uploaded {local_path} to S3: {s3_key}")

        return True

    except ClientError as e:
        logger.error(f"AWS S3 error uploading directory: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Error uploading directory to S3: {e}", exc_info=True)
        return False


def download_parsed_document(key: str) -> Optional[str]:
    try:
        if not AWS_S3_BUCKET:
            logger.error("AWS_S3_BUCKET is not set")
            return None

        s3_client = _s3_client()

        response = s3_client.get_object(Bucket=AWS_S3_BUCKET, Key=key)
        content = response['Body'].read().decode('utf-8')
        logger.debug(f"Downloaded parsed document from S3: {key}")
        return content

    except ClientError as e:
        logger.error(f"AWS S3 error downloading parsed document: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Error downloading parsed document from S3: {e}", exc_info=True)
        return None
