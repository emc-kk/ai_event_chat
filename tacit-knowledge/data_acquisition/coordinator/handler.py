"""
Lambda コーディネーター — エントリポイント。

EventBridge (毎60秒) からトリガーされ、以下を実行:
1. スケジューラ: cron定義に従いタスクを生成
2. ヘルスモニター: 滞留タスクの検知と再キュー
3. 動的ディスカバリで各AWSアカウントのEC2インスタンスを発見
4. SSH接続してリソースチェック（本来の処理に影響を出さない）
5. 余裕のあるインスタンスにタスクをpush実行
6. 結果をDBに書き込む
"""

import json
import logging

from config import MAX_TASKS_PER_INVOCATION
from health_monitor import check_stale_tasks
from instance_discovery import discover_all_instances, get_ssh_key_for_account, sync_discovered_to_db
from result_handler import save_failure, save_records
from scheduler import check_and_create_tasks
from ssh_executor import SSHError, check_resources, dispatch_task, execute_task
from task_dispatcher import (
    claim_tasks,
    get_active_instances,
    get_queued_task_count,
    handle_task_failure,
    mark_task_done,
    release_task,
    update_instance_metrics,
)

logger = logging.getLogger("data_acquisition.coordinator")
logging.basicConfig(level=logging.INFO)


def lambda_handler(event, context):
    """EventBridge からトリガーされるメインハンドラー。"""

    # 1. スケジューラ: cron該当ジョブからタスクを生成
    scheduled = 0
    try:
        scheduled = check_and_create_tasks()
    except Exception as e:
        logger.error(f"Scheduler error: {e}", exc_info=True)

    # 2. ヘルスモニター: 滞留SSHタスクの検知と再キュー
    health = {}
    try:
        health = check_stale_tasks()
    except Exception as e:
        logger.error(f"Health monitor error: {e}", exc_info=True)

    # 3. キューにあるSSHタスク数を確認
    queued_count = get_queued_task_count(dispatch_target="ssh")
    if queued_count == 0:
        logger.info("No queued SSH tasks")
        return {"dispatched": 0, "queued": 0, "scheduled": scheduled, "health": health}

    logger.info(f"Found {queued_count} queued SSH tasks")

    # 2. 動的ディスカバリ: 各AWSアカウントからインスタンスを発見
    discovered = discover_all_instances()
    if discovered:
        # 発見したインスタンスをDBに同期 (新規INSERT / 既存UPDATE / 消失→offline)
        try:
            sync_discovered_to_db(discovered)
        except Exception as e:
            logger.warning(f"Failed to sync discovered instances to DB: {e}")

    # 3. DBからアクティブインスタンスを取得 (ディスカバリ結果 + 手動登録分)
    instances = get_active_instances()
    if not instances:
        logger.info("No active scraper instances")
        return {"dispatched": 0, "queued": queued_count, "instances": 0}

    logger.info(f"Found {len(instances)} active instances")

    dispatched = 0
    skipped_instances = 0

    # Lambda残り時間の安全マージン (60秒)
    SAFETY_MARGIN_MS = 60_000

    for instance in instances:
        if dispatched >= MAX_TASKS_PER_INVOCATION:
            logger.info(f"Reached max tasks per invocation ({MAX_TASKS_PER_INVOCATION})")
            break

        # Lambda残り時間チェック
        if context and hasattr(context, "get_remaining_time_in_millis"):
            remaining = context.get_remaining_time_in_millis()
            if remaining < SAFETY_MARGIN_MS:
                logger.warning(f"Lambda timeout approaching ({remaining}ms remaining), stopping dispatch")
                break

        # 3. リソースチェック (SSH)
        try:
            metrics = check_resources(instance)
        except SSHError as e:
            logger.info(f"Instance {instance['name']} not reachable: {e}")
            skipped_instances += 1
            continue

        # リソース状況をDBに記録
        update_instance_metrics(instance["id"], metrics)

        # リソース超過チェック
        thresholds = instance.get("resource_thresholds", {})
        if isinstance(thresholds, str):
            thresholds = json.loads(thresholds)

        if _is_overloaded(metrics, thresholds):
            logger.info(
                f"Instance {instance['name']} overloaded "
                f"(CPU={metrics.get('cpu_percent')}%, MEM={metrics.get('memory_percent')}%)"
            )
            continue

        # 4. 空きスロット計算
        max_concurrency = instance.get("max_concurrency", 2)
        current_tasks = instance.get("current_tasks", 0)
        available_slots = max_concurrency - current_tasks
        if available_slots <= 0:
            logger.info(f"Instance {instance['name']} at capacity ({current_tasks}/{max_concurrency})")
            continue

        # 5. タスクを claim
        capabilities = instance.get("capabilities", [])
        if isinstance(capabilities, str):
            capabilities = json.loads(capabilities)

        tasks = claim_tasks(
            dispatch_target="ssh",
            instance_id=instance["id"],
            capabilities=capabilities,
            limit=min(available_slots, MAX_TASKS_PER_INVOCATION - dispatched),
        )

        if not tasks:
            continue

        # 6. 各タスクをSSHでディスパッチ
        for task in tasks:
            # タスク実行前にも残り時間チェック
            if context and hasattr(context, "get_remaining_time_in_millis"):
                remaining = context.get_remaining_time_in_millis()
                if remaining < SAFETY_MARGIN_MS:
                    logger.warning(f"Lambda timeout approaching ({remaining}ms remaining), releasing unclaimed tasks")
                    release_task(task["id"])
                    break

            task_id = task["id"]
            task_payload = task["task_payload"]
            if isinstance(task_payload, str):
                task_payload = json.loads(task_payload)

            try:
                # callback_urlがあれば fire-and-forget、なければ同期実行 (フォールバック)
                if task_payload.get("callback_url"):
                    dispatch_task(instance, task_payload)
                    dispatched += 1
                    # 結果は受信Lambdaが処理するので、ここでは待たない
                else:
                    # レガシー: 同期実行
                    result = execute_task(instance, task_payload)
                    if result.get("status") == "success":
                        save_records(task, result.get("records", []))
                        mark_task_done(task_id)
                    else:
                        error = result.get("error", "Unknown error")
                        handle_task_failure(task_id, error)
                        save_failure(task, error)
                    dispatched += 1

            except SSHError as e:
                release_task(task_id)
                logger.warning(f"SSH error during task {task_id} on {instance['name']}: {e}")
                break

    result = {
        "dispatched": dispatched,
        "queued": queued_count,
        "scheduled": scheduled,
        "health": health,
        "instances": len(instances),
        "skipped_instances": skipped_instances,
    }
    logger.info(f"Dispatch complete: {result}")
    return result


def _is_overloaded(metrics: dict, thresholds: dict) -> bool:
    """リソースがしきい値を超えているか判定。"""
    cpu_max = thresholds.get("cpu_max", 70)
    mem_max = thresholds.get("memory_max", 85)

    cpu = metrics.get("cpu_percent", 0)
    mem = metrics.get("memory_percent", 0)

    return cpu > cpu_max or mem > mem_max
