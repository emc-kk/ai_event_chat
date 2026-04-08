"""
Writer Lambda — SQSキューからスクレイピング結果をバッチ取得しDBに保存。

SQS Event Source Mapping でトリガー:
- BatchSize: 10
- MaximumBatchingWindowInSeconds: 60
- 10件溜まるか60秒経過で起動
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from config import MAX_TASK_ATTEMPTS
from db import get_cursor

logger = logging.getLogger("data_acquisition.writer")
logging.basicConfig(level=logging.INFO)


def lambda_handler(event, context):
    """SQS Event Source Mapping からトリガー。"""
    records = event.get("Records", [])
    if not records:
        return {"processed": 0}

    logger.info(f"Processing {len(records)} SQS messages")

    processed = 0
    errors = 0

    for sqs_record in records:
        try:
            body = json.loads(sqs_record["body"])
            _process_result(body)
            processed += 1
        except Exception as e:
            logger.error(f"Failed to process message: {e}", exc_info=True)
            errors += 1

    logger.info(f"Batch complete: {processed} processed, {errors} errors")

    # エラーがあった場合、SQSの部分バッチ失敗レスポンスを返す
    if errors > 0:
        failed_ids = []
        for i, sqs_record in enumerate(records):
            if i >= processed:
                failed_ids.append({"itemIdentifier": sqs_record["messageId"]})
        if failed_ids:
            return {"batchItemFailures": failed_ids}

    return {"processed": processed}


def _process_result(body: dict):
    """1タスクの結果をDBに保存。"""
    task_id = body["task_id"]
    job_id = body["job_id"]
    run_id = body["run_id"]
    status = body["status"]

    if status == "success":
        records = body.get("records", [])
        _save_records(task_id, job_id, run_id, body, records)
        _mark_task_done(task_id)
        logger.info(f"Task {task_id}: saved {len(records)} records")
    elif status == "failed":
        error = body.get("error", "Unknown error")
        _handle_task_failure(task_id, error)
        _save_failure(run_id)
        logger.warning(f"Task {task_id}: failed — {error}")


def _save_records(task_id: str, job_id: str, run_id: str, body: dict, records: list):
    if not records:
        return

    source_url = body.get("source_url", "")
    company_id = body.get("company_id", "")
    now = datetime.now(timezone.utc)

    if not company_id:
        with get_cursor(commit=False) as cur:
            cur.execute("SELECT company_id FROM data_acquisition_jobs WHERE id = %s", (job_id,))
            row = cur.fetchone()
            company_id = row["company_id"] if row else ""

    with get_cursor() as cur:
        for record in records:
            cur.execute("""
                INSERT INTO data_acquisition_records
                    (id, company_id, job_id, run_id, task_id,
                     record_type, data, source_url, fetched_at,
                     created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()), company_id, job_id, run_id, task_id,
                "default",
                json.dumps(record, ensure_ascii=False, default=str),
                source_url, now, now, now,
            ))

        cur.execute("""
            UPDATE data_acquisition_job_runs
            SET tasks_completed = tasks_completed + 1, updated_at = NOW()
            WHERE id = %s
        """, (run_id,))

        _check_run_complete(cur, run_id)


def _mark_task_done(task_id: str):
    with get_cursor() as cur:
        cur.execute("""
            UPDATE data_acquisition_tasks
            SET status = 'done', completed_at = NOW(), updated_at = NOW()
            WHERE id = %s
        """, (task_id,))


def _handle_task_failure(task_id: str, error: str):
    with get_cursor() as cur:
        cur.execute("SELECT attempt FROM data_acquisition_tasks WHERE id = %s", (task_id,))
        row = cur.fetchone()
        if not row:
            return

        new_attempt = row["attempt"] + 1
        if new_attempt >= MAX_TASK_ATTEMPTS:
            cur.execute("""
                UPDATE data_acquisition_tasks
                SET status = 'failed', attempt = %s,
                    assigned_instance_id = NULL, assigned_at = NULL, updated_at = NOW()
                WHERE id = %s
            """, (new_attempt, task_id))
        else:
            cur.execute("""
                UPDATE data_acquisition_tasks
                SET status = 'queued', attempt = %s,
                    assigned_instance_id = NULL, assigned_at = NULL, updated_at = NOW()
                WHERE id = %s
            """, (new_attempt, task_id))


def _save_failure(run_id: str):
    if not run_id:
        return
    with get_cursor() as cur:
        cur.execute("""
            UPDATE data_acquisition_job_runs
            SET tasks_failed = tasks_failed + 1, updated_at = NOW()
            WHERE id = %s
        """, (run_id,))
        _check_run_complete(cur, run_id)


def _check_run_complete(cur, run_id: str):
    cur.execute("""
        SELECT tasks_total, tasks_completed, tasks_failed
        FROM data_acquisition_job_runs WHERE id = %s
    """, (run_id,))
    run = cur.fetchone()
    if run and (run["tasks_completed"] + run["tasks_failed"]) >= run["tasks_total"]:
        cur.execute("""
            UPDATE data_acquisition_job_runs
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = %s
        """, (run_id,))
