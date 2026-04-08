"""
ヘルスモニター: SSH タスクの滞留検知 + Slack 通知。

Lambda Coordinator から毎60秒呼び出される。
Instruction Server から移植 (SQS/DLQ チェックを除去、SSH タスクのみ)。
"""

import logging

import requests as http_requests

from config import MAX_TASK_ATTEMPTS, SLACK_WEBHOOK_URL, TASK_STALE_THRESHOLD_MINUTES
from db import get_cursor

logger = logging.getLogger("data_acquisition.coordinator.health_monitor")


def check_stale_tasks() -> dict:
    """SSH タスクの滞留を検知し、再キューまたはfailed化する。

    Returns:
        {"requeued": int, "failed": int}
    """
    result = {"requeued": 0, "failed": 0}

    try:
        with get_cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as cnt
                FROM data_acquisition_tasks
                WHERE status = 'processing'
                  AND dispatch_target = 'ssh'
                  AND assigned_at < NOW() - INTERVAL '%s minutes'
            """, (TASK_STALE_THRESHOLD_MINUTES,))
            row = cur.fetchone()
            stale_count = row["cnt"] if row else 0

            if stale_count == 0:
                return result

            logger.warning(f"Stale SSH tasks detected: {stale_count}")
            _alert(f"長期滞留タスク(SSH): {stale_count}件が{TASK_STALE_THRESHOLD_MINUTES}分以上処理中")

            cur.execute("""
                UPDATE data_acquisition_tasks
                SET status = CASE
                        WHEN attempt >= %s THEN 'failed'
                        ELSE 'queued'
                    END,
                    attempt = attempt + 1,
                    assigned_instance_id = NULL,
                    assigned_at = NULL,
                    updated_at = NOW()
                WHERE status = 'processing'
                  AND dispatch_target = 'ssh'
                  AND assigned_at < NOW() - INTERVAL '%s minutes'
                RETURNING id, status
            """, (MAX_TASK_ATTEMPTS, TASK_STALE_THRESHOLD_MINUTES))
            reclaimed = cur.fetchall()

            result["requeued"] = sum(1 for r in reclaimed if r["status"] == "queued")
            result["failed"] = sum(1 for r in reclaimed if r["status"] == "failed")

            if result["requeued"] > 0 or result["failed"] > 0:
                logger.info(
                    f"SSH task reclamation: {result['requeued']} requeued, "
                    f"{result['failed']} failed (max_attempts exceeded)"
                )

    except Exception as e:
        logger.error(f"Failed to check stale SSH tasks: {e}")

    return result


def _alert(message: str):
    """Slack Webhook で通知。"""
    if not SLACK_WEBHOOK_URL:
        logger.warning(f"[ALERT (no Slack)] {message}")
        return

    try:
        http_requests.post(
            SLACK_WEBHOOK_URL,
            json={"text": f":warning: [DataAcquisition] {message}"},
            timeout=10,
        )
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")
