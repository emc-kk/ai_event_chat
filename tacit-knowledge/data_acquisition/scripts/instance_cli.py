#!/usr/bin/env python3
"""
スクレイパーインスタンス管理CLI。

Usage:
    python instance_cli.py register --name prod-web-1 --host 54.xx.xx.xx --user ec2-user --key-file ~/.ssh/key.pem
    python instance_cli.py list
    python instance_cli.py setup --name prod-web-1
    python instance_cli.py set-dispatch <job_id> ssh
    python instance_cli.py pause --name prod-web-1
    python instance_cli.py resume --name prod-web-1
    python instance_cli.py remove --name prod-web-1
"""

import argparse
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "instruction_server"))

from db import get_cursor


def register(args):
    """インスタンスを登録し、SSH鍵をSecrets Managerに保存する。"""
    instance_id = f"si-{uuid.uuid4().hex[:12]}"

    # SSH鍵をSecrets Managerに保存
    ssh_key_secret_id = None
    if args.key_file:
        try:
            import boto3

            with open(os.path.expanduser(args.key_file)) as f:
                key_pem = f.read()

            secret_name = f"skillrelay/production/scraper-ssh-{args.name}"
            sm = boto3.client("secretsmanager")
            try:
                sm.create_secret(Name=secret_name, SecretString=key_pem)
                print(f"  SSH key stored in Secrets Manager: {secret_name}")
            except sm.exceptions.ResourceExistsException:
                sm.update_secret(SecretId=secret_name, SecretString=key_pem)
                print(f"  SSH key updated in Secrets Manager: {secret_name}")

            ssh_key_secret_id = secret_name
        except ImportError:
            print("  Warning: boto3 not available, SSH key not stored in Secrets Manager")
            ssh_key_secret_id = args.key_file
        except Exception as e:
            print(f"  Warning: Failed to store SSH key: {e}")
            ssh_key_secret_id = args.key_file

    # DB に登録
    capabilities = args.capabilities.split(",") if args.capabilities else [
        "web_scrape", "csv_download", "pdf_download", "api"
    ]

    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO scraper_instances
                (id, name, host, port, ssh_user, ssh_key_secret_id,
                 runtime, max_concurrency, capabilities, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
                host = EXCLUDED.host,
                port = EXCLUDED.port,
                ssh_user = EXCLUDED.ssh_user,
                ssh_key_secret_id = EXCLUDED.ssh_key_secret_id,
                runtime = EXCLUDED.runtime,
                max_concurrency = EXCLUDED.max_concurrency,
                capabilities = EXCLUDED.capabilities,
                status = 'active',
                updated_at = NOW()
            """,
            (
                instance_id,
                args.name,
                args.host,
                args.port,
                args.user,
                ssh_key_secret_id,
                args.runtime,
                args.max_concurrency,
                json.dumps(capabilities),
            ),
        )

    print(f"\nInstance registered:")
    print(f"  ID:       {instance_id}")
    print(f"  Name:     {args.name}")
    print(f"  Host:     {args.host}:{args.port}")
    print(f"  User:     {args.user}")
    print(f"  Runtime:  {args.runtime}")
    print(f"  Max Conc: {args.max_concurrency}")


def list_instances(args):
    """登録済みインスタンスの一覧。"""
    with get_cursor(commit=False) as cur:
        cur.execute("""
            SELECT id, name, host, port, ssh_user, status, runtime,
                   max_concurrency, current_tasks, capabilities,
                   last_resource_check, last_checked_at, created_at
            FROM scraper_instances
            ORDER BY status, name
        """)
        instances = cur.fetchall()

    if not instances:
        print("No instances registered.")
        return

    print(f"\n{'Name':<20} {'Host':<18} {'Status':<12} {'Runtime':<8} {'Tasks':<8} {'CPU%':<6} {'MEM%':<6}")
    print("-" * 80)

    for inst in instances:
        metrics = inst.get("last_resource_check") or {}
        if isinstance(metrics, str):
            metrics = json.loads(metrics)
        cpu = f"{metrics.get('cpu_percent', '?')}" if metrics else "?"
        mem = f"{metrics.get('memory_percent', '?')}" if metrics else "?"
        tasks = f"{inst['current_tasks']}/{inst['max_concurrency']}"

        print(
            f"{inst['name']:<20} {inst['host']:<18} {inst['status']:<12} "
            f"{inst['runtime']:<8} {tasks:<8} {cpu:<6} {mem:<6}"
        )


def setup(args):
    """SSH経由でsetup.shを実行。"""
    with get_cursor(commit=False) as cur:
        cur.execute(
            "SELECT host, port, ssh_user, ssh_key_secret_id FROM scraper_instances WHERE name = %s",
            (args.name,),
        )
        inst = cur.fetchone()

    if not inst:
        print(f"Instance '{args.name}' not found")
        return

    setup_script = os.path.join(
        os.path.dirname(__file__), "..", "agent", "setup.sh"
    )
    if not os.path.exists(setup_script):
        print(f"setup.sh not found at {setup_script}")
        return

    key_opt = f"-i {inst['ssh_key_secret_id']}" if inst["ssh_key_secret_id"] else ""
    host = f"{inst['ssh_user']}@{inst['host']}"
    port = inst.get("port", 22)

    print(f"Setting up {args.name} ({host}:{port})...")
    print(f"  1. Uploading setup.sh...")
    os.system(f"scp -P {port} {key_opt} {setup_script} {host}:~/setup.sh")
    print(f"  2. Running setup.sh (fire-and-forget)...")

    s3_opt = f"--s3-package {args.s3_package}" if args.s3_package else ""
    os.system(f"ssh -p {port} {key_opt} {host} 'nohup bash ~/setup.sh {s3_opt} > /var/log/scraper-agent-setup.log 2>&1 &'")

    print(f"  Setup started in background. Check logs:")
    print(f"  ssh {host} 'tail -f /var/log/scraper-agent-setup.log'")


def set_dispatch(args):
    """ジョブの dispatch_target を変更。"""
    target = args.target
    if target not in ("sqs", "ssh", "both"):
        print(f"Error: target must be sqs|ssh|both, got '{target}'")
        return

    with get_cursor() as cur:
        cur.execute(
            "UPDATE data_acquisition_jobs SET dispatch_target = %s, updated_at = NOW() WHERE id = %s RETURNING name",
            (target, args.job_id),
        )
        row = cur.fetchone()

    if row:
        print(f"Job '{row['name']}' dispatch target set to: {target}")
    else:
        print(f"Job '{args.job_id}' not found")


def pause_instance(args):
    """インスタンスを一時停止。"""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE scraper_instances SET status = 'paused', updated_at = NOW() WHERE name = %s RETURNING id",
            (args.name,),
        )
        row = cur.fetchone()

    if row:
        print(f"Instance '{args.name}' paused")
    else:
        print(f"Instance '{args.name}' not found")


def resume_instance(args):
    """インスタンスを再開。"""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE scraper_instances SET status = 'active', updated_at = NOW() WHERE name = %s RETURNING id",
            (args.name,),
        )
        row = cur.fetchone()

    if row:
        print(f"Instance '{args.name}' resumed")
    else:
        print(f"Instance '{args.name}' not found")


def remove_instance(args):
    """インスタンスを登録解除。"""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE scraper_instances SET status = 'deregistered', updated_at = NOW() WHERE name = %s RETURNING id",
            (args.name,),
        )
        row = cur.fetchone()

    if row:
        print(f"Instance '{args.name}' deregistered")
    else:
        print(f"Instance '{args.name}' not found")


def main():
    parser = argparse.ArgumentParser(description="Scraper Instance Manager")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # register
    reg = subparsers.add_parser("register", help="Register a new scraper instance")
    reg.add_argument("--name", required=True, help="Instance name")
    reg.add_argument("--host", required=True, help="SSH host (IP or hostname)")
    reg.add_argument("--port", type=int, default=22, help="SSH port")
    reg.add_argument("--user", default="ec2-user", help="SSH user")
    reg.add_argument("--key-file", help="Path to SSH private key file")
    reg.add_argument("--runtime", default="python", choices=["docker", "python"])
    reg.add_argument("--max-concurrency", type=int, default=2)
    reg.add_argument("--capabilities", help="Comma-separated scraper types")

    # list
    subparsers.add_parser("list", help="List all registered instances")

    # setup
    sup = subparsers.add_parser("setup", help="Run setup.sh on an instance via SSH")
    sup.add_argument("--name", required=True, help="Instance name")
    sup.add_argument("--s3-package", help="S3 URL for scraper package")

    # set-dispatch
    sd = subparsers.add_parser("set-dispatch", help="Set job dispatch target")
    sd.add_argument("job_id", help="Job ID")
    sd.add_argument("target", choices=["sqs", "ssh", "both"], help="Dispatch target")

    # pause / resume / remove
    p = subparsers.add_parser("pause", help="Pause an instance")
    p.add_argument("--name", required=True)

    r = subparsers.add_parser("resume", help="Resume an instance")
    r.add_argument("--name", required=True)

    rm = subparsers.add_parser("remove", help="Deregister an instance")
    rm.add_argument("--name", required=True)

    args = parser.parse_args()

    if args.command == "register":
        register(args)
    elif args.command == "list":
        list_instances(args)
    elif args.command == "setup":
        setup(args)
    elif args.command == "set-dispatch":
        set_dispatch(args)
    elif args.command == "pause":
        pause_instance(args)
    elif args.command == "resume":
        resume_instance(args)
    elif args.command == "remove":
        remove_instance(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
