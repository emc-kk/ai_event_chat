"""
SSH 経由でリモートインスタンスにコマンドを実行する。
paramiko を使用し、SSH秘密鍵は Secrets Manager から取得。
"""

import io
import json
import logging

import boto3
import paramiko

from config import DOCKER_IMAGE, SSH_TIMEOUT, TASK_TIMEOUT

logger = logging.getLogger("data_acquisition.coordinator.ssh")

# Secrets Manager のキャッシュ (Lambda warm invocation 間で再利用)
_key_cache: dict[str, str] = {}


class SSHError(Exception):
    """SSH接続/実行エラー。"""
    pass


def _get_ssh_key(secret_id: str) -> str:
    """Secrets Manager から SSH 秘密鍵を取得 (キャッシュあり)。"""
    if secret_id in _key_cache:
        return _key_cache[secret_id]

    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=secret_id)
    key_pem = resp["SecretString"]
    _key_cache[secret_id] = key_pem
    return key_pem


def _connect(instance: dict) -> paramiko.SSHClient:
    """SSH 接続を確立する。"""
    try:
        key_pem = _get_ssh_key(instance["ssh_key_secret_id"])
        key = paramiko.RSAKey.from_private_key(io.StringIO(key_pem))
    except Exception as e:
        raise SSHError(f"Failed to load SSH key: {e}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(
            hostname=instance["host"],
            port=instance.get("port", 22),
            username=instance.get("ssh_user", "ec2-user"),
            pkey=key,
            timeout=SSH_TIMEOUT,
            banner_timeout=SSH_TIMEOUT,
            auth_timeout=SSH_TIMEOUT,
        )
    except Exception as e:
        raise SSHError(f"SSH connection failed to {instance['host']}: {e}")

    return ssh


def check_resources(instance: dict) -> dict:
    """SSH 経由でリソースチェックスクリプトを実行。

    Returns:
        dict: {cpu_percent, memory_percent, ...} or raises SSHError
    """
    try:
        ssh = _connect(instance)
        _, stdout, stderr = ssh.exec_command(
            "/opt/scraper-agent/.venv/bin/python /opt/scraper-agent/check_resources.py",
            timeout=SSH_TIMEOUT + 5,
        )
        output = stdout.read().decode().strip()
        exit_code = stdout.channel.recv_exit_status()
        ssh.close()

        if exit_code != 0:
            errors = stderr.read().decode().strip()
            raise SSHError(f"Resource check failed (exit={exit_code}): {errors}")

        return json.loads(output)

    except SSHError:
        raise
    except json.JSONDecodeError as e:
        raise SSHError(f"Invalid JSON from resource check: {e}")
    except Exception as e:
        raise SSHError(f"Resource check error: {e}")


def dispatch_task(instance: dict, task_payload: dict):
    """SSH 経由でスクレイピングタスクを非同期実行 (fire-and-forget)。

    nohupでバックグラウンド実行し、SSH接続を即切断する。
    結果は受信Lambda (callback_url) にスクレイパーが直接POSTする。

    Args:
        instance: scraper_instances テーブルの行
        task_payload: タスクペイロード (source, extraction, callback_url, callback_token 等)

    Raises:
        SSHError: SSH接続失敗時
    """
    task_json = json.dumps(task_payload, ensure_ascii=False, default=str)
    # シングルクォートをエスケープ
    task_json_escaped = task_json.replace("'", "'\\''")

    runner = "/opt/scraper-agent/.venv/bin/python /opt/scraper-agent/run_task.py"

    # nohupでバックグラウンド実行。heredocでタスクJSONをstdinに渡す
    cmd = f"nohup bash -c 'echo '\"'\"'{task_json_escaped}'\"'\"' | {runner}' > /tmp/scraper-{task_payload.get('id', 'unknown')}.log 2>&1 &"

    try:
        ssh = _connect(instance)
        ssh.exec_command(cmd)
        ssh.close()
        logger.info(f"Dispatched task {task_payload.get('id')} to {instance['name']} (fire-and-forget)")

    except SSHError:
        raise
    except Exception as e:
        raise SSHError(f"Task dispatch error: {e}")


def execute_task(instance: dict, task_payload: dict) -> dict:
    """SSH 経由でスクレイピングタスクを同期実行 (レガシー/フォールバック)。

    callback_url が設定されていないタスク用。
    """
    runtime = instance.get("runtime", "python")
    task_json = json.dumps(task_payload, ensure_ascii=False, default=str)

    if runtime == "docker":
        cmd = f"docker run --rm -i --shm-size=256m {DOCKER_IMAGE}"
    else:
        cmd = "/opt/scraper-agent/.venv/bin/python /opt/scraper-agent/run_task.py"

    try:
        ssh = _connect(instance)
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=TASK_TIMEOUT)

        stdin.write(task_json)
        stdin.channel.shutdown_write()

        output = stdout.read().decode().strip()
        errors = stderr.read().decode().strip()
        exit_code = stdout.channel.recv_exit_status()
        ssh.close()

        if not output:
            return {
                "status": "failed",
                "error": errors or "No output from task execution",
                "records": [],
            }

        result = json.loads(output)
        return result

    except SSHError:
        raise
    except json.JSONDecodeError:
        return {
            "status": "failed",
            "error": f"Invalid JSON output: {output[:500]}",
            "records": [],
        }
    except Exception as e:
        raise SSHError(f"Task execution error: {e}")
