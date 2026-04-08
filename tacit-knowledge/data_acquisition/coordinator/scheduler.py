"""
スケジューラ: cron定義に従い Job Definition を Task に分解し DB に投入。

Lambda Coordinator から毎60秒呼び出される。
Instruction Server から移植 (asyncio/SQS 依存を除去)。
"""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from config import MAX_TASK_ATTEMPTS, RECEIVER_AUTH_TOKEN, RECEIVER_URL
from db import get_cursor

logger = logging.getLogger("data_acquisition.coordinator.scheduler")


def check_and_create_tasks() -> int:
    """activeなジョブのcronを評価し、該当するものからタスクを生成。

    Returns:
        生成したタスク数
    """
    with get_cursor(commit=False) as cur:
        cur.execute("""
            SELECT dj.id, dj.company_id, dj.name, dj.job_definition, dj.status,
                   dj.dispatch_target,
                   (SELECT MAX(started_at) FROM data_acquisition_job_runs WHERE job_id = dj.id) AS last_run_at
            FROM data_acquisition_jobs dj
            WHERE dj.status = 'active'
        """)
        jobs = cur.fetchall()

    now = datetime.now(timezone.utc)
    total_tasks = 0

    for job in jobs:
        job_def = job["job_definition"]
        schedule = job_def.get("schedule", {})
        cron_expr = schedule.get("cron")

        if not cron_expr:
            continue

        if not _should_run(cron_expr, now):
            continue

        # 重複ディスパッチ防止: 直近5分以内に同じジョブが実行されていたらスキップ
        last_run = job.get("last_run_at")
        if last_run:
            if isinstance(last_run, str):
                last_run = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
            if last_run.tzinfo is None:
                last_run = last_run.replace(tzinfo=timezone.utc)
            if (now - last_run) < timedelta(minutes=5):
                continue

        logger.info(f"Dispatching job: {job['name']} ({job['id']})")
        count = _create_run_and_tasks(job)
        total_tasks += count

    if total_tasks > 0:
        logger.info(f"Scheduler created {total_tasks} tasks")
    return total_tasks


def _should_run(cron_expr: str, now: datetime) -> bool:
    """簡易cronマッチング (minute hour day month weekday)。
    weekdayは標準cron規約: 0=Sunday, 1=Monday, ..., 6=Saturday。
    """
    parts = cron_expr.split()
    if len(parts) != 5:
        return False

    # Python weekday(): 0=Monday → cron: 0=Sunday に変換
    cron_weekday = (now.weekday() + 1) % 7

    checks = [
        (parts[0], now.minute),
        (parts[1], now.hour),
        (parts[2], now.day),
        (parts[3], now.month),
        (parts[4], cron_weekday),
    ]

    for pattern, value in checks:
        if pattern == "*":
            continue
        if "/" in pattern:
            base, step = pattern.split("/")
            base_val = 0 if base == "*" else int(base)
            if (value - base_val) % int(step) != 0:
                return False
        elif "-" in pattern:
            low, high = pattern.split("-")
            if not (int(low) <= value <= int(high)):
                return False
        elif "," in pattern:
            if value not in [int(x) for x in pattern.split(",")]:
                return False
        else:
            if value != int(pattern):
                return False

    return True


def _create_run_and_tasks(job: dict) -> int:
    """Job RunレコードとTaskレコードを作成。全タスクはSSHディスパッチ。"""
    job_def = job["job_definition"]
    source = job_def.get("source", {})
    extraction = job_def.get("extraction", {})
    retry = job_def.get("retry", {})

    run_id = str(uuid.uuid4())
    tasks = _expand_pagination(job, source, extraction, retry, run_id)

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO data_acquisition_job_runs
                (id, job_id, status, started_at, tasks_total, tasks_completed, tasks_failed, created_at, updated_at)
            VALUES (%s, %s, 'running', NOW(), %s, 0, 0, NOW(), NOW())
        """, (run_id, job["id"], len(tasks)))

        for task in tasks:
            cur.execute("""
                INSERT INTO data_acquisition_tasks
                    (id, job_id, run_id, status, task_payload, attempt,
                     dispatch_target, created_at, updated_at)
                VALUES (%s, %s, %s, 'queued', %s, 0, 'ssh', NOW(), NOW())
            """, (task["id"], job["id"], run_id, json.dumps(task)))

    logger.info(f"Created run {run_id} with {len(tasks)} tasks for job {job['id']}")
    return len(tasks)


def _expand_pagination(job, source, extraction, retry, run_id) -> list:
    """ページネーション定義を展開し、複数Taskを生成。"""
    pagination = source.get("pagination")
    url_pattern = source.get("url_pattern", source.get("url", ""))

    if pagination and "{page}" in url_pattern:
        start_page = pagination.get("start", 1)
        end_page = pagination.get("end", 1)
        tasks = []
        for page in range(start_page, end_page + 1):
            url = url_pattern.replace("{page}", str(page))
            tasks.append(_build_task(job, source, extraction, retry, run_id, url))
        return tasks
    else:
        url = url_pattern or source.get("url", "")
        return [_build_task(job, source, extraction, retry, run_id, url)]


def _build_task(job, source, extraction, retry, run_id, url) -> dict:
    task_source = dict(source)
    task_source["url"] = url
    if "url_pattern" in task_source:
        del task_source["url_pattern"]
    if "pagination" in task_source:
        del task_source["pagination"]

    task = {
        "id": f"task_{uuid.uuid4().hex[:12]}",
        "job_id": job["id"],
        "run_id": run_id,
        "company_id": job["company_id"],
        "source": task_source,
        "extraction": extraction,
        "retry": retry,
        "attempt": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # 受信Lambda callback (fire-and-forget用)
    if RECEIVER_URL:
        task["callback_url"] = RECEIVER_URL
    if RECEIVER_AUTH_TOKEN:
        task["callback_token"] = RECEIVER_AUTH_TOKEN

    return task
