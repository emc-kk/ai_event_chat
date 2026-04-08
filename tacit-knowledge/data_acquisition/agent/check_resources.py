#!/usr/bin/env python3
"""
CPU/メモリ/ディスク/負荷をJSON出力する軽量スクリプト。
Lambda コーディネーターが SSH 経由で実行し、インスタンスのリソース状況を確認する。

Usage:
    python check_resources.py
    # Output: {"cpu_percent": 23.5, "memory_percent": 45.2, ...}
"""

import json
import psutil


def get_metrics() -> dict:
    cpu = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    load_1m, load_5m, load_15m = psutil.getloadavg()

    return {
        "cpu_percent": cpu,
        "cpu_count": psutil.cpu_count(),
        "memory_percent": mem.percent,
        "memory_available_mb": round(mem.available / 1e6),
        "memory_total_mb": round(mem.total / 1e6),
        "disk_percent": disk.percent,
        "load_avg_1m": round(load_1m, 2),
        "load_avg_5m": round(load_5m, 2),
        "load_avg_15m": round(load_15m, 2),
    }


if __name__ == "__main__":
    print(json.dumps(get_metrics()))
