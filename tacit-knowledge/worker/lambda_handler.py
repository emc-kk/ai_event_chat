"""
Lambda handler for SQS-triggered document processing.
Wraps the existing worker logic for use in preview environments.
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile

import boto3

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def resolve_ssm_secrets():
    """Fetch secrets from SSM Parameter Store and set as env vars (cold start only)."""
    ssm_mappings = {
        'SSM_POSTGRES_PASSWORD': 'POSTGRES_PASSWORD',
        'SSM_OPENAI_API_KEY': 'OPENAI_API_KEY',
        'SSM_COHERE_API_KEY': 'COHERE_API_KEY',
    }
    to_resolve = {
        ssm_key: env_key
        for ssm_key, env_key in ssm_mappings.items()
        if os.environ.get(ssm_key) and not os.environ.get(env_key)
    }
    if not to_resolve:
        return

    ssm = boto3.client('ssm')
    for ssm_key, env_key in to_resolve.items():
        param_name = os.environ[ssm_key]
        try:
            resp = ssm.get_parameter(Name=param_name, WithDecryption=True)
            os.environ[env_key] = resp['Parameter']['Value']
            logger.info(f"Resolved {env_key} from SSM ({param_name})")
        except Exception as e:
            logger.error(f"Failed to resolve {env_key} from SSM ({param_name}): {e}")
            raise


# Resolve SSM secrets at module load (cold start)
resolve_ssm_secrets()

from src.utils.database import DatabaseConnection, check_and_update_request_status, update_request_status
from src.workflows import (
    run_plan_generation,
    run_qa_generation,
    run_manual_generation,
    run_manual_video_update,
)
from src.workflows.steps.data_acquisition_index import data_acquisition_index_step


def cleanup_tmp():
    """Clean /tmp of stale files from previous warm invocations."""
    tmp_dir = tempfile.gettempdir()
    for item in os.listdir(tmp_dir):
        item_path = os.path.join(tmp_dir, item)
        try:
            if os.path.isdir(item_path):
                shutil.rmtree(item_path, ignore_errors=True)
            elif os.path.isfile(item_path):
                os.remove(item_path)
        except Exception:
            pass


async def process_sqs_record(body: dict, db: DatabaseConnection):
    """
    Process a single SQS message body.
    Unlike worker.py's process_message(), this does NOT call delete_message
    (Lambda manages deletion) and re-raises exceptions for batch failure reporting.
    """
    action_type = body.get('action_type')

    if action_type in ('data_acquisition_upload', 'datasource_upload'):
        company_id = body.get('company_id')
        data_source_file_ids = body.get('data_source_file_ids', [])
        logger.info(f"[RECEIVED] action_type={action_type}, company={company_id}, files={data_source_file_ids}")
        await data_acquisition_index_step(
            db=db,
            data_source_file_ids=data_source_file_ids,
            company_id=company_id,
        )
        logger.info(f"[COMPLETE] {action_type}")
        return

    request_id = body['request_id']
    document_ids = body.get('document_ids') or []
    topic_id = body['topic_id']
    next_status = body.get('next_status', 'not_started')
    request_type = body.get('request_type', 'hearing')

    logger.info(
        f"[RECEIVED] action_type={action_type}, request_id={request_id}, "
        f"topic_id={topic_id}, request_type={request_type}, "
        f"next_status={next_status}, document_ids={document_ids}"
    )

    if request_type == 'manual':
        if action_type == 'manual_create':
            logger.info("[START] Manual generation workflow")
            success = await run_manual_generation(
                db=db,
                request_id=request_id,
                topic_id=topic_id,
                document_ids=document_ids,
            )
            if success:
                logger.info("[DONE] Manual generation workflow")
            else:
                logger.warning("[DONE] Manual generation workflow (failed)")

        elif action_type == 'manual_video_update':
            logger.info("[START] Video update workflow")
            success = await run_manual_video_update(
                db=db,
                request_id=request_id,
                topic_id=topic_id,
                document_ids=document_ids,
            )
            if success:
                logger.info("[DONE] Video update workflow")
            else:
                logger.warning("[DONE] Video update workflow (failed)")

        else:
            logger.warning(f"[SKIP] Unknown action_type for manual: {action_type}")

    elif request_type == 'hearing':
        if action_type in ['hearing_create', 'hearing_update', 'rehearing_create']:
            logger.info("[START] Plan generation workflow")
            await run_plan_generation(
                db=db,
                request_id=request_id,
                topic_id=topic_id,
                next_status=next_status,
                document_ids=document_ids,
            )
            logger.info("[DONE] Plan generation workflow")

        elif action_type == 'hearing_finish':
            logger.info("[START] QA generation workflow")
            result = await run_qa_generation(
                db=db,
                request_id=request_id,
                topic_id=topic_id,
            )
            if result.get('success'):
                if result.get('has_conflicts'):
                    next_status = 'awaiting_verification'
                    logger.info("[DONE] QA generation workflow (conflicts found, status -> awaiting_verification)")
                else:
                    logger.info("[DONE] QA generation workflow")
            else:
                logger.warning("[DONE] QA generation workflow (failed)")

        else:
            logger.warning(f"[SKIP] Unknown action_type for hearing: {action_type}")

    else:
        logger.warning(f"[SKIP] Unknown request_type: {request_type}")

    await asyncio.to_thread(check_and_update_request_status, db, request_id, next_status)
    logger.info(f"[COMPLETE] {action_type}")


def handler(event, context):
    """
    Lambda handler for SQS event source.
    Uses ReportBatchItemFailures for partial batch response.
    """
    cleanup_tmp()

    records = event.get('Records', [])
    if not records:
        return {'batchItemFailures': []}

    db = DatabaseConnection()
    db.connect()

    batch_item_failures = []

    try:
        for record in records:
            message_id = record['messageId']
            try:
                body = json.loads(record['body'])
                asyncio.run(process_sqs_record(body, db))
            except Exception as e:
                logger.error(f"[FAILED] message_id={message_id}: {e}", exc_info=True)
                batch_item_failures.append({'itemIdentifier': message_id})
    finally:
        db.close()

    return {'batchItemFailures': batch_item_failures}
