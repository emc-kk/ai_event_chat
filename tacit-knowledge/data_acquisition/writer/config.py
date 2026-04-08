"""Writer Lambda設定。"""

import os

POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.environ.get("POSTGRES_PORT", "5432")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_DB = os.environ.get("POSTGRES_DB", "skillrelay_production")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")
SSM_PASSWORD_PATH = os.environ.get("SSM_PASSWORD_PATH", "")

MAX_TASK_ATTEMPTS = int(os.environ.get("MAX_TASK_ATTEMPTS", "3"))
