"""
タスク割当ロジック。
PostgreSQL の FOR UPDATE SKIP LOCKED でレース条件を防止する。
"""

import json
import logging
from datetime import datetime, timezone

from db import get_cursor
from config import MAX_TASK_ATTEMPTS

logger = logging.getLogger("data_acquisition.coordinator.dispatcher")


def get_queued_task_count(dispatch_target: str = "ssh") -> int:
    """キューに入っているタスク数を取得。"""
    with get_cursor(commit=False) as cur:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM data_acquisition_tasks WHERE dispatch_target = %s AND status = 'queued'",
            (dispatch_target,),
        )
        return cur.fetchone()["cnt"]


def get_active_instances() -> list[dict]:
    """アクティブなスクレイパーインスタンスを取得。"""
    with get_cursor(commit=False) as cur:
        cur.execute("""
            SELECT id, name, host, port, ssh_user, ssh_key_secret_id,
                   runtime, max_concurrency, current_tasks,
                   resource_thresholds, capabilities
            FROM scraper_instances
            WHERE status = 'active'
            ORDER BY current_tasks ASC, name ASC
        """)
        return cur.fetchall()


def claim_tasks(
    dispatch_target: str,
    instance_id: str,
    capabilities: list[str],
    limit: int = 1,
) -> list[dict]:
    """FOR UPDATE SKIP LOCKED でアトミックにタスクを割当。

    複数のLambda呼び出しが同時に実行されても、
    PostgreSQL の行レベルロックで重複割当を防止する。
    """
    if not capabilities:
        return []

    with get_cursor() as cur:
        # capabilities に基づくフィルタ
        type_placeholders = ",".join(["%s"] * len(capabilities))

        cur.execute(
            f"""
            WITH claimable AS (
                SELECT id
                FROM data_acquisition_tasks
                WHERE dispatch_target = %s
                  AND status = 'queued'
                  AND attempt < %s
                  AND task_payload->'source'->>'type' = ANY(%s)
                ORDER BY created_at ASC
                LIMIT %s
                FOR UPDATE SKIP LOCKED
            )
            UPDATE data_acquisition_tasks t
            SET status = 'processing',
                assigned_instance_id = %s,
                assigned_at = NOW(),
                updated_at = NOW()
            FROM claimable c
            WHERE t.id = c.id
            RETURNING t.id, t.task_payload, t.job_id, t.run_id, t.attempt
            """,
            (dispatch_target, MAX_TASK_ATTEMPTS, capabilities, limit, instance_id),
        )
        rows = cur.fetchall()

        if rows:
            logger.info(
                f"Claimed {len(rows)} tasks for instance {instance_id}"
            )
        return rows


def mark_task_done(task_id: str):
    """タスクを完了にする。"""
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE data_acquisition_tasks
            SET status = 'done', completed_at = NOW(), updated_at = NOW()
            WHERE id = %s
            """,
            (task_id,),
        )
        logger.info(f"Task {task_id} marked as done")


def handle_task_failure(task_id: str, error: str, max_attempts: int = MAX_TASK_ATTEMPTS):
    """タスク失敗を処理。attempt < max_attempts なら queued に戻す。"""
    with get_cursor() as cur:
        cur.execute(
            "SELECT attempt FROM data_acquisition_tasks WHERE id = %s",
            (task_id,),
        )
        row = cur.fetchone()
        if not row:
            return

        new_attempt = row["attempt"] + 1

        if new_attempt >= max_attempts:
            cur.execute(
                """
                UPDATE data_acquisition_tasks
                SET status = 'failed', attempt = %s,
                    assigned_instance_id = NULL, assigned_at = NULL,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (new_attempt, task_id),
            )
            logger.warning(
                f"Task {task_id} permanently failed after {new_attempt} attempts: {error}"
            )
        else:
            cur.execute(
                """
                UPDATE data_acquisition_tasks
                SET status = 'queued', attempt = %s,
                    assigned_instance_id = NULL, assigned_at = NULL,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (new_attempt, task_id),
            )
            logger.info(
                f"Task {task_id} returned to queue (attempt {new_attempt}/{max_attempts}): {error}"
            )


def release_task(task_id: str):
    """SSH失敗時にタスクをキューに戻す (attempt は増やさない)。"""
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE data_acquisition_tasks
            SET status = 'queued',
                assigned_instance_id = NULL, assigned_at = NULL,
                updated_at = NOW()
            WHERE id = %s
            """,
            (task_id,),
        )
        logger.info(f"Task {task_id} released back to queue (SSH failure)")


def update_instance_metrics(instance_id: str, metrics: dict | None):
    """インスタンスのリソースメトリクスを更新。"""
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE scraper_instances
            SET last_resource_check = %s,
                last_checked_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (json.dumps(metrics) if metrics else None, instance_id),
        )
