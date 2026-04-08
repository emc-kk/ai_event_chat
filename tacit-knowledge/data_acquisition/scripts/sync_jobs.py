#!/usr/bin/env python3
"""
YAML GitOps → DB同期スクリプト。
data_acquisition/jobs/ 配下のYAML定義を読み、data_acquisition_jobs テーブルに UPSERT する。

Usage:
    python sync_jobs.py                    # dry-run (変更内容を表示)
    python sync_jobs.py --apply            # 実際にDBに反映
    python sync_jobs.py --apply --verbose  # 詳細ログ付き

ディレクトリ構成:
    data_acquisition/jobs/
        companies.yml                 # 企業マッピング
        fuji-electric/                # 企業ディレクトリ = companies.yml のキー
            jepx-spot.yml
            nonfossil.yml
            energy-market.yml
            carbon-credit.yml
            inactive.yml
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import yaml

# DB接続用
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "instruction_server"))
from db import get_connection


def load_companies(jobs_dir: Path) -> dict:
    """companies.yml を読み込み、ディレクトリ名 → company_id のマッピングを返す。"""
    companies_file = jobs_dir / "companies.yml"
    if not companies_file.exists():
        print(f"ERROR: {companies_file} not found")
        sys.exit(1)

    with open(companies_file) as f:
        data = yaml.safe_load(f)

    return {k: v["id"] for k, v in data.get("companies", {}).items()}


def resolve_dynamic_values(job_def: dict) -> dict:
    """動的プレースホルダー ({current_fy}, {previous_fy}) を実際の値に置換する。"""
    now = datetime.now()
    current_fy = now.year if now.month >= 4 else now.year - 1
    previous_fy = current_fy - 1

    def replace_in_value(v):
        if isinstance(v, str):
            return v.replace("{current_fy}", str(current_fy)).replace("{previous_fy}", str(previous_fy))
        elif isinstance(v, dict):
            return {k2: replace_in_value(v2) for k2, v2 in v.items()}
        elif isinstance(v, list):
            return [replace_in_value(item) for item in v]
        return v

    return replace_in_value(job_def)


def load_all_jobs(jobs_dir: Path, company_map: dict) -> list[dict]:
    """全YAMLファイルからジョブ定義を読み込む。"""
    all_jobs = []

    for company_dir_name, company_id in company_map.items():
        company_dir = jobs_dir / company_dir_name
        if not company_dir.is_dir():
            print(f"WARNING: Directory {company_dir} not found, skipping")
            continue

        for yml_file in sorted(company_dir.glob("*.yml")):
            with open(yml_file) as f:
                data = yaml.safe_load(f)

            if not data or "jobs" not in data:
                continue

            for job in data["jobs"]:
                # job_definition を構築 (source, extraction, schedule, retry)
                job_definition = {}
                for key in ("source", "extraction", "schedule", "retry"):
                    if key in job:
                        job_definition[key] = job[key]

                # 動的値を解決
                job_definition = resolve_dynamic_values(job_definition)

                all_jobs.append({
                    "id": job["id"],
                    "company_id": company_id,
                    "name": job["name"],
                    "description": job.get("description", ""),
                    "status": job.get("status", "active"),
                    "job_definition": job_definition,
                    "source_file": str(yml_file.relative_to(jobs_dir)),
                })

    return all_jobs


def get_existing_jobs(conn) -> dict:
    """DBから既存ジョブを取得。"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, company_id, name, description, status, job_definition
            FROM data_acquisition_jobs
        """)
        columns = [desc[0] for desc in cur.description]
        return {
            row[0]: dict(zip(columns, row))
            for row in cur.fetchall()
        }


def diff_jobs(yaml_jobs: list[dict], db_jobs: dict) -> dict:
    """YAML定義とDB状態の差分を計算する。"""
    yaml_ids = {j["id"] for j in yaml_jobs}
    db_ids = set(db_jobs.keys())

    new_jobs = [j for j in yaml_jobs if j["id"] not in db_ids]
    removed_ids = db_ids - yaml_ids

    updated_jobs = []
    for j in yaml_jobs:
        if j["id"] in db_ids:
            db_job = db_jobs[j["id"]]
            changes = []

            if j["name"] != db_job["name"]:
                changes.append(f"name: '{db_job['name']}' → '{j['name']}'")
            if j["description"] != (db_job["description"] or ""):
                changes.append("description changed")
            if j["status"] != db_job["status"]:
                changes.append(f"status: '{db_job['status']}' → '{j['status']}'")
            if j["company_id"] != db_job["company_id"]:
                changes.append(f"company_id: '{db_job['company_id']}' → '{j['company_id']}'")

            # job_definition の比較
            db_def = db_job["job_definition"]
            if isinstance(db_def, str):
                db_def = json.loads(db_def)
            if j["job_definition"] != db_def:
                changes.append("job_definition changed")

            if changes:
                updated_jobs.append({"job": j, "changes": changes})

    return {
        "new": new_jobs,
        "updated": updated_jobs,
        "removed": removed_ids,
    }


def print_diff(diff: dict):
    """差分を表示する。"""
    if not diff["new"] and not diff["updated"] and not diff["removed"]:
        print("\nNo changes detected. DB is in sync with YAML definitions.")
        return

    if diff["new"]:
        print(f"\n  NEW ({len(diff['new'])} jobs):")
        for j in diff["new"]:
            print(f"    + {j['id']} — {j['name']} [{j['status']}]")
            print(f"      source: {j['source_file']}")

    if diff["updated"]:
        print(f"\n  UPDATED ({len(diff['updated'])} jobs):")
        for item in diff["updated"]:
            j = item["job"]
            print(f"    ~ {j['id']} — {j['name']}")
            for change in item["changes"]:
                print(f"        {change}")

    if diff["removed"]:
        print(f"\n  NOT IN YAML ({len(diff['removed'])} jobs):")
        for job_id in sorted(diff["removed"]):
            print(f"    ? {job_id} (exists in DB but not in YAML — no action taken)")

    total = len(diff["new"]) + len(diff["updated"])
    print(f"\n  Total: {total} changes")


def apply_changes(conn, diff: dict, verbose: bool = False):
    """差分をDBに適用する。"""
    with conn.cursor() as cur:
        # 新規ジョブ
        for j in diff["new"]:
            cur.execute(
                """
                INSERT INTO data_acquisition_jobs
                    (id, company_id, name, description, job_definition, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                """,
                (
                    j["id"],
                    j["company_id"],
                    j["name"],
                    j["description"],
                    json.dumps(j["job_definition"], ensure_ascii=False),
                    j["status"],
                ),
            )
            if verbose:
                print(f"  INSERT: {j['id']}")

        # 更新ジョブ
        for item in diff["updated"]:
            j = item["job"]
            cur.execute(
                """
                UPDATE data_acquisition_jobs
                SET company_id = %s,
                    name = %s,
                    description = %s,
                    job_definition = %s,
                    status = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (
                    j["company_id"],
                    j["name"],
                    j["description"],
                    json.dumps(j["job_definition"], ensure_ascii=False),
                    j["status"],
                    j["id"],
                ),
            )
            if verbose:
                print(f"  UPDATE: {j['id']}")

        # DB にのみ存在するジョブは削除しない（安全策）
        # 手動で削除するか、status='inactive' に変更して管理

        conn.commit()

    applied = len(diff["new"]) + len(diff["updated"])
    print(f"\n  Applied {applied} changes to database.")


def main():
    parser = argparse.ArgumentParser(
        description="Sync YAML job definitions to data_acquisition_jobs table"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually apply changes to DB (default: dry-run)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output",
    )
    args = parser.parse_args()

    jobs_dir = Path(__file__).parent.parent / "jobs"
    if not jobs_dir.exists():
        print(f"ERROR: Jobs directory not found: {jobs_dir}")
        sys.exit(1)

    print(f"Jobs directory: {jobs_dir}")

    # 1. 企業マッピング読込
    company_map = load_companies(jobs_dir)
    print(f"Companies: {', '.join(company_map.keys())}")

    # 2. YAML定義読込
    yaml_jobs = load_all_jobs(jobs_dir, company_map)
    print(f"YAML jobs loaded: {len(yaml_jobs)}")

    # 3. DB接続 + 既存ジョブ取得
    conn = get_connection()
    try:
        db_jobs = get_existing_jobs(conn)
        print(f"DB jobs found: {len(db_jobs)}")

        # 4. 差分計算
        diff = diff_jobs(yaml_jobs, db_jobs)
        print_diff(diff)

        # 5. 適用
        if args.apply:
            if not diff["new"] and not diff["updated"]:
                print("\nNothing to apply.")
            else:
                apply_changes(conn, diff, verbose=args.verbose)
        else:
            if diff["new"] or diff["updated"]:
                print("\n  (dry-run mode — use --apply to write changes to DB)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
