"""
受信Lambda — スクレイパーからの結果を受け取りSQSキューに投入。

API Gateway でHTTPSエンドポイントとして公開。
認証 + バリデーションのみ行い、DB書き込みは Writer Lambda に委譲。

認証: Authorization: Bearer <token> ヘッダーで検証。
"""

import json
import logging
import os

import boto3

logger = logging.getLogger("data_acquisition.receiver")
logging.basicConfig(level=logging.INFO)

RECEIVER_AUTH_TOKEN = os.environ.get("RECEIVER_AUTH_TOKEN", "")
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")

_sqs = None


def _get_sqs():
    global _sqs
    if _sqs is None:
        _sqs = boto3.client("sqs", region_name="ap-northeast-1")
    return _sqs


def lambda_handler(event, context):
    """API Gateway からトリガー。"""

    # 認証
    headers = event.get("headers", {})
    auth = headers.get("authorization", "") or headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != RECEIVER_AUTH_TOKEN:
        return _response(401, {"error": "Unauthorized"})

    # リクエストボディ
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON"})

    task_id = body.get("task_id")
    job_id = body.get("job_id")
    run_id = body.get("run_id")
    status = body.get("status")

    if not all([task_id, job_id, run_id, status]):
        return _response(400, {"error": "Missing required fields: task_id, job_id, run_id, status"})

    if status not in ("success", "failed"):
        return _response(400, {"error": f"Invalid status: {status}"})

    # SQSキューに投入
    try:
        _get_sqs().send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(body, ensure_ascii=False, default=str),
            MessageAttributes={
                "task_id": {"DataType": "String", "StringValue": task_id},
                "status": {"DataType": "String", "StringValue": status},
            },
        )
        logger.info(f"Task {task_id} ({status}) queued to SQS")
        return _response(200, {"status": "queued", "task_id": task_id})

    except Exception as e:
        logger.error(f"SQS send failed for task {task_id}: {e}", exc_info=True)
        return _response(500, {"error": "Failed to queue result"})


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
