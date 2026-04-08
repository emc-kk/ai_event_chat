"""
タスク結果を処理し、data_acquisition_records テーブルに書き込む。
既存の ResultConsumer._process_result() のロジックを再利用。
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from db import get_cursor

logger = logging.getLogger("data_acquisition.coordinator.result")


def save_records(task: dict, records: list[dict]):
    """スクレイピング結果をDBに保存する。

    Args:
        task: claim_tasks() の戻り値 (id, task_payload, job_id, run_id)
        records: スクレイピングで取得したレコードのリスト
    """
    if not records:
        logger.info(f"Task {task['id']}: no records to save")
        return

    task_payload = task["task_payload"]
    if isinstance(task_payload, str):
        task_payload = json.loads(task_payload)

    source_url = task_payload.get("source", {}).get("url", "")
    company_id = task_payload.get("company_id", "")
    job_id = task["job_id"]
    run_id = task["run_id"]
    task_id = task["id"]
    now = datetime.now(timezone.utc)

    # company_id が task_payload にない場合、job テーブルから取得
    if not company_id:
        with get_cursor(commit=False) as cur:
            cur.execute(
                "SELECT company_id FROM data_acquisition_jobs WHERE id = %s",
                (job_id,),
            )
            row = cur.fetchone()
            company_id = row["company_id"] if row else ""

    with get_cursor() as cur:
        for record in records:
            record_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO data_acquisition_records
                    (id, company_id, job_id, run_id, task_id,
                     record_type, data, source_url, fetched_at,
                     created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    record_id,
                    company_id,
                    job_id,
                    run_id,
                    task_id,
                    "default",
                    json.dumps(record, ensure_ascii=False, default=str),
                    source_url,
                    now,
                    now,
                    now,
                ),
            )

        # Job Run のカウンターを更新
        cur.execute(
            """
            UPDATE data_acquisition_job_runs
            SET tasks_completed = tasks_completed + 1,
                updated_at = NOW()
            WHERE id = %s
            """,
            (run_id,),
        )

        # Run が完了したか確認
        cur.execute(
            """
            SELECT tasks_total, tasks_completed, tasks_failed
            FROM data_acquisition_job_runs
            WHERE id = %s
            """,
            (run_id,),
        )
        run = cur.fetchone()
        if run and (run["tasks_completed"] + run["tasks_failed"]) >= run["tasks_total"]:
            cur.execute(
                """
                UPDATE data_acquisition_job_runs
                SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                WHERE id = %s
                """,
                (run_id,),
            )
            logger.info(f"Run {run_id} completed")

    logger.info(
        f"Task {task_id}: saved {len(records)} records "
        f"(job={job_id}, run={run_id})"
    )


def save_failure(task: dict, error: str):
    """タスク失敗をJob Runに記録。"""
    run_id = task.get("run_id")
    if not run_id:
        return

    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE data_acquisition_job_runs
            SET tasks_failed = tasks_failed + 1,
                updated_at = NOW()
            WHERE id = %s
            """,
            (run_id,),
        )

        # Run が完了したか確認
        cur.execute(
            """
            SELECT tasks_total, tasks_completed, tasks_failed
            FROM data_acquisition_job_runs
            WHERE id = %s
            """,
            (run_id,),
        )
        run = cur.fetchone()
        if run and (run["tasks_completed"] + run["tasks_failed"]) >= run["tasks_total"]:
            cur.execute(
                """
                UPDATE data_acquisition_job_runs
                SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                WHERE id = %s
                """,
                (run_id,),
            )
