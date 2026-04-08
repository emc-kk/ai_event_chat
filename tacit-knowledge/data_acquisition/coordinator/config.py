"""
Lambda コーディネーター設定。
環境変数から読み込み。
"""

import os

# PostgreSQL
POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.environ.get("POSTGRES_PORT", "5432")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_DB = os.environ.get("POSTGRES_DB", "skillrelay_production")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
SSM_PASSWORD_PATH = os.environ.get("SSM_PASSWORD_PATH", "")

# Dispatch
MAX_TASKS_PER_INVOCATION = int(os.environ.get("MAX_TASKS_PER_INVOCATION", "10"))
SSH_TIMEOUT = int(os.environ.get("SSH_TIMEOUT", "10"))
TASK_TIMEOUT = int(os.environ.get("TASK_TIMEOUT", "300"))
MAX_TASK_ATTEMPTS = int(os.environ.get("MAX_TASK_ATTEMPTS", "3"))

# Docker
DOCKER_IMAGE = os.environ.get(
    "DOCKER_IMAGE",
    "778389812638.dkr.ecr.ap-northeast-1.amazonaws.com/skillrelay-scraper-agent:latest",
)

# Receiver (callback)
RECEIVER_URL = os.environ.get("RECEIVER_URL", "")
RECEIVER_AUTH_TOKEN = os.environ.get("RECEIVER_AUTH_TOKEN", "")

# Health Monitor
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
TASK_STALE_THRESHOLD_MINUTES = int(os.environ.get("TASK_STALE_THRESHOLD_MINUTES", "30"))
