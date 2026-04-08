import sys
import asyncio
import json
import logging
import boto3

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

from src.config import (
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_ENDPOINT_URL,
    AWS_S3_BUCKET,
    SQS_QUEUE_URL,
    POSTGRES_HOST,
    POSTGRES_DB,
)
from src.utils import (
    DatabaseConnection,
    check_and_update_request_status,
)
from src.utils.database import update_request_status
from src.workflows import run_plan_generation, run_qa_generation, run_manual_generation, run_manual_video_update
from src.workflows.steps.data_acquisition_index import data_acquisition_index_step

sqs_client_kwargs = {'region_name': AWS_REGION}
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    sqs_client_kwargs['aws_access_key_id'] = AWS_ACCESS_KEY_ID
    sqs_client_kwargs['aws_secret_access_key'] = AWS_SECRET_ACCESS_KEY
if AWS_ENDPOINT_URL:
    sqs_client_kwargs['endpoint_url'] = AWS_ENDPOINT_URL

sqs_client = boto3.client('sqs', **sqs_client_kwargs)


async def process_message(message, db: DatabaseConnection):
    try:
        body = json.loads(message['Body'])
        action_type = body.get('action_type')

        # data_acquisition_upload は request_id / topic_id を持たないため先に処理
        # (backward compat: also accept legacy 'datasource_upload')
        if action_type in ('data_acquisition_upload', 'datasource_upload'):
            company_id = body.get('company_id')
            data_source_file_ids = body.get('data_source_file_ids', [])
            logger.info(f"[RECEIVED] action_type={action_type}, company={company_id}, files={data_source_file_ids}")
            logger.info(f"[START] DataAcquisition index workflow (company={company_id}, files={data_source_file_ids})")
            try:
                await data_acquisition_index_step(
                    db=db,
                    data_source_file_ids=data_source_file_ids,
                    company_id=company_id,
                )
                logger.info("[DONE] DataAcquisition index workflow")
                sqs_client.delete_message(
                    QueueUrl=SQS_QUEUE_URL,
                    ReceiptHandle=message['ReceiptHandle']
                )
                logger.info(f"[COMPLETE] {action_type}")
            except Exception as e:
                logger.error(f"[FAILED] DataAcquisition index workflow: {e}", exc_info=True)
                logger.info(f"[RETRY] Message will be retried via SQS visibility timeout (message_id={message.get('MessageId')})")
            return

        request_id = body['request_id']
        document_ids = body.get('document_ids') or []
        data_source_file_ids = body.get('data_source_file_ids') or []
        topic_id = body['topic_id']
        next_status = body.get('next_status', 'not_started')
        request_type = body.get('request_type', 'hearing')

        logger.info(f"[RECEIVED] action_type={action_type}, request_id={request_id}, topic_id={topic_id}, "
                    f"request_type={request_type}, next_status={next_status}, document_ids={document_ids}, "
                    f"data_source_file_ids={data_source_file_ids}")

        if request_type == 'manual':
            if action_type == 'manual_create':
                logger.info("[START] Manual generation workflow")
                try:
                    success = await run_manual_generation(
                        db=db,
                        request_id=request_id,
                        topic_id=topic_id,
                        document_ids=document_ids,
                        data_source_file_ids=data_source_file_ids,
                    )
                    if success:
                        logger.info("[DONE] Manual generation workflow")
                    else:
                        logger.warning("[DONE] Manual generation workflow (failed)")
                except Exception as e:
                    logger.error(f"[FAILED] Manual generation workflow: {e}", exc_info=True)

            elif action_type == 'manual_video_update':
                logger.info("[START] Video update workflow")
                try:
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
                except Exception as e:
                    logger.error(f"[FAILED] Video update workflow: {e}", exc_info=True)

            else:
                logger.warning(f"[SKIP] Unknown action_type for manual: {action_type}")

        elif request_type == 'hearing':
            if action_type in ['hearing_create', 'hearing_update', 'rehearing_create']:
                logger.info("[START] Plan generation workflow")
                try:
                    await run_plan_generation(
                        db=db,
                        request_id=request_id,
                        topic_id=topic_id,
                        next_status=next_status,
                        document_ids=document_ids,
                        data_source_file_ids=data_source_file_ids,
                    )
                    logger.info("[DONE] Plan generation workflow")
                except Exception as e:
                    logger.error(f"[FAILED] Plan generation workflow: {e}", exc_info=True)

            elif action_type == 'hearing_finish':
                logger.info("[START] QA generation workflow")
                try:
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
                except Exception as e:
                    logger.error(f"[FAILED] QA generation workflow: {e}", exc_info=True)

            else:
                logger.warning(f"[SKIP] Unknown action_type for hearing: {action_type}")

        else:
            logger.warning(f"[SKIP] Unknown request_type: {request_type}")

        if action_type not in ('data_acquisition_upload', 'datasource_upload'):
            await asyncio.to_thread(check_and_update_request_status, db, request_id, next_status)

        sqs_client.delete_message(
            QueueUrl=SQS_QUEUE_URL,
            ReceiptHandle=message['ReceiptHandle']
        )
        logger.info(f"[COMPLETE] {action_type}")

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)

        try:
            if 'request_id' in locals() and 'next_status' in locals() and 'db' in locals():
                await asyncio.to_thread(check_and_update_request_status, db, request_id, next_status)
        except Exception as update_error:
            logger.error(f"Failed to update status on error: {update_error}")


async def poll_sqs_messages():
    db = DatabaseConnection()
    db.connect()

    max_messages = 1
    wait_time_seconds = 20

    logger.info(f"SQS Worker started - Queue: {SQS_QUEUE_URL}")

    try:
        while True:
            try:
                response = await asyncio.to_thread(
                    sqs_client.receive_message,
                    QueueUrl=SQS_QUEUE_URL,
                    MaxNumberOfMessages=max_messages,
                    WaitTimeSeconds=wait_time_seconds,
                    AttributeNames=['All'],
                    MessageAttributeNames=['All']
                )

                messages = response.get('Messages', [])

                if messages:
                    for message in messages:
                        await process_message(message, db)

                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error polling SQS: {e}", exc_info=True)
                await asyncio.sleep(5)

    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")

    finally:
        db.close()
        logger.info("SQS Worker stopped")


if __name__ == "__main__":
    required_env_vars = {
        "AWS_S3_BUCKET": AWS_S3_BUCKET,
        "SQS_DOCUMENT_PROCESSING_QUEUE_URL": SQS_QUEUE_URL,
        "POSTGRES_HOST": POSTGRES_HOST,
        "POSTGRES_DB": POSTGRES_DB,
    }

    missing_vars = [var for var, value in required_env_vars.items() if not value]

    if missing_vars:
        logger.error("Missing required environment variables:")
        for var in missing_vars:
            logger.error(f"  - {var}")
        sys.exit(1)

    asyncio.run(poll_sqs_messages())
