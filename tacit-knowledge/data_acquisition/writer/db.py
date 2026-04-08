"""PostgreSQL 接続管理。"""

import logging
from contextlib import contextmanager

import boto3
import psycopg2
import psycopg2.extras

from config import (
    POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD,
    POSTGRES_PORT, POSTGRES_USER, SSM_PASSWORD_PATH,
)

logger = logging.getLogger("data_acquisition.writer.db")
_connection = None


def _get_password() -> str:
    if POSTGRES_PASSWORD:
        return POSTGRES_PASSWORD
    if SSM_PASSWORD_PATH:
        ssm = boto3.client("ssm")
        resp = ssm.get_parameter(Name=SSM_PASSWORD_PATH, WithDecryption=True)
        return resp["Parameter"]["Value"]
    raise ValueError("POSTGRES_PASSWORD or SSM_PASSWORD_PATH must be set")


def get_connection():
    global _connection
    if _connection is None or _connection.closed:
        _connection = psycopg2.connect(
            host=POSTGRES_HOST, port=POSTGRES_PORT,
            dbname=POSTGRES_DB, user=POSTGRES_USER,
            password=_get_password(), connect_timeout=10,
        )
        _connection.autocommit = False
    return _connection


@contextmanager
def get_cursor(commit: bool = True):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
