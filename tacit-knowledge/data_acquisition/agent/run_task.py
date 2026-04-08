#!/usr/bin/env python3
"""
Lambda → SSH → このスクリプトが実行される。
stdinからタスクJSONを受け取り、stdoutに結果JSONを出力。

Usage:
    echo '{"source": {...}, "extraction": {...}}' | python run_task.py
    python run_task.py < task.json
"""

import json
import logging
import os
import sys

# scraper パッケージを import するためにパスを追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "worker"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,  # ログは stderr に出力 (stdout は結果JSON専用)
)
logger = logging.getLogger("agent.run_task")


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"status": "failed", "error": "Empty input", "records": []}))
            sys.exit(1)

        task = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"status": "failed", "error": f"Invalid JSON: {e}", "records": []}))
        sys.exit(1)

    try:
        from scraper import create_scraper

        scraper = create_scraper(task)
        records = list(scraper.execute(task))

        result = {
            "status": "success",
            "records": records,
            "count": len(records),
        }
        print(json.dumps(result, ensure_ascii=False, default=str))

    except ImportError as e:
        logger.error(f"Import error: {e}")
        print(json.dumps({
            "status": "failed",
            "error": f"Scraper module not found: {e}. Run setup.sh first.",
            "records": [],
        }))
        sys.exit(1)

    except Exception as e:
        logger.error(f"Task execution failed: {e}", exc_info=True)
        print(json.dumps({
            "status": "failed",
            "error": str(e),
            "records": [],
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
