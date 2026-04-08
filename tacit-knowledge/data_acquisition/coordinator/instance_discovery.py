"""
動的インスタンスディスカバリモジュール。

SSM Parameter Store に保存されたアカウント認証情報とルールに基づき、
各AWSアカウントのEC2インスタンスをリアルタイムに発見する。

スポットインスタンスのように頻繁にIDが変わるケースに対応。
静的なDB登録ではなく、EC2 API で都度発見する方式。
"""

import fnmatch
import json
import logging
from typing import Optional

import boto3

logger = logging.getLogger("data_acquisition.coordinator.discovery")

# SSM からロード済みのアカウント情報キャッシュ（Lambda warm invocation 用）
_accounts_cache: Optional[list] = None
_ssh_keys_cache: dict = {}

# ディスカバリルールのプレフィックス
SSM_ACCOUNTS_PREFIX = "/skillrelay/production/scraper-accounts"


def _get_ssm_client():
    """SkillRelay アカウントの SSM クライアント。"""
    return boto3.client("secretsmanager"), boto3.client("ssm")


def load_account_configs(force_refresh: bool = False) -> list:
    """
    SSM Parameter Store から全アカウント設定をロード。

    Returns:
        [
            {
                "name": "arrow",
                "account_id": "361788162091",
                "region": "ap-northeast-1",
                "access_key_id": "AKIA...",
                "secret_access_key": "...",
                "discovery_rules": { ... },
            },
            ...
        ]
    """
    global _accounts_cache

    if _accounts_cache and not force_refresh:
        return _accounts_cache

    ssm = boto3.client("ssm")
    accounts = []

    # アカウント名一覧を取得（パスのプレフィックスで検索）
    try:
        response = ssm.get_parameters_by_path(
            Path=SSM_ACCOUNTS_PREFIX,
            Recursive=True,
            WithDecryption=True,
        )

        # パラメータをアカウント名ごとにグループ化
        params_by_account: dict = {}
        all_params = response.get("Parameters", [])

        # ページネーション
        while response.get("NextToken"):
            response = ssm.get_parameters_by_path(
                Path=SSM_ACCOUNTS_PREFIX,
                Recursive=True,
                WithDecryption=True,
                NextToken=response["NextToken"],
            )
            all_params.extend(response.get("Parameters", []))

        for param in all_params:
            # /skillrelay/production/scraper-accounts/{name}/{key}
            parts = param["Name"].replace(SSM_ACCOUNTS_PREFIX + "/", "").split("/")
            if len(parts) == 2:
                account_name, key = parts
                if account_name not in params_by_account:
                    params_by_account[account_name] = {}
                params_by_account[account_name][key] = param["Value"]

        for account_name, params in params_by_account.items():
            rules = params.get("discovery-rules", "{}")
            try:
                rules = json.loads(rules) if isinstance(rules, str) else rules
            except json.JSONDecodeError:
                rules = {}

            accounts.append({
                "name": account_name,
                "account_id": params.get("account-id", ""),
                "region": params.get("region", "ap-northeast-1"),
                "access_key_id": params.get("access-key-id", ""),
                "secret_access_key": params.get("secret-access-key", ""),
                "discovery_rules": rules,
            })

        _accounts_cache = accounts
        logger.info(f"Loaded {len(accounts)} account configs from SSM")

    except Exception as e:
        logger.error(f"Failed to load account configs from SSM: {e}")
        return []

    return accounts


def discover_instances(account: dict) -> list:
    """
    指定アカウントの EC2 インスタンスを発見し、ルールでフィルタリング。

    Args:
        account: load_account_configs() が返すアカウント設定

    Returns:
        [
            {
                "instance_id": "i-xxx",
                "name": "arrow-delivery-spot01",
                "host": "57.180.38.128",  # PublicIP
                "private_ip": "172.31.44.193",
                "type": "c5.2xlarge",
                "key_name": "arrow",
                "account_name": "arrow",
                "account_id": "361788162091",
                "region": "ap-northeast-1",
                "launch_time": "2026-03-10T00:53:51+00:00",
            },
            ...
        ]
    """
    rules = account.get("discovery_rules", {})

    if not rules.get("enabled", False):
        logger.debug(f"Account {account['name']} discovery disabled, skipping")
        return []

    name_patterns = rules.get("name_patterns", [])
    exclude_patterns = rules.get("exclude_patterns", [])
    allowed_types = rules.get("instance_types", [])
    allowed_amis = rules.get("ami_filter", [])
    platform_filter = rules.get("platform", "linux")
    max_total = rules.get("max_total_instances", 10)

    try:
        ec2 = boto3.client(
            "ec2",
            region_name=account.get("region", "ap-northeast-1"),
            aws_access_key_id=account["access_key_id"],
            aws_secret_access_key=account["secret_access_key"],
        )

        # running インスタンスのみ取得
        filters = [{"Name": "instance-state-name", "Values": ["running"]}]

        # Windowsを除外
        if platform_filter == "linux":
            pass  # PlatformDetailsでフィルタ（API側フィルタが限定的なのでクライアント側で）

        response = ec2.describe_instances(Filters=filters)

        instances = []
        for reservation in response.get("Reservations", []):
            for inst in reservation.get("Instances", []):
                # 名前タグ取得
                name = ""
                for tag in inst.get("Tags", []):
                    if tag["Key"] == "Name":
                        name = tag["Value"]
                        break

                # Windowsは除外
                platform = inst.get("PlatformDetails", "Linux/UNIX")
                if platform_filter == "linux" and "Windows" in platform:
                    continue

                # 名前パターンマッチ
                if name_patterns:
                    matched = any(fnmatch.fnmatch(name, p) for p in name_patterns)
                    if not matched:
                        continue

                # 除外パターン
                if exclude_patterns:
                    excluded = any(fnmatch.fnmatch(name, p) for p in exclude_patterns)
                    if excluded:
                        continue

                # AMI フィルタ (v6等の特定AMIのみターゲット)
                if allowed_amis and inst.get("ImageId", "") not in allowed_amis:
                    continue

                # インスタンスタイプフィルタ
                if allowed_types and inst["InstanceType"] not in allowed_types:
                    continue

                # PublicIP が必要
                public_ip = inst.get("PublicIpAddress")
                if not public_ip:
                    continue

                instances.append({
                    "instance_id": inst["InstanceId"],
                    "name": name,
                    "host": public_ip,
                    "private_ip": inst.get("PrivateIpAddress", ""),
                    "type": inst["InstanceType"],
                    "ami_id": inst.get("ImageId", ""),
                    "key_name": inst.get("KeyName", ""),
                    "account_name": account["name"],
                    "account_id": account.get("account_id", ""),
                    "region": account.get("region", "ap-northeast-1"),
                    "launch_time": str(inst.get("LaunchTime", "")),
                    "ssh_user": _guess_ssh_user(inst),
                    "resource_thresholds": rules.get("resource_thresholds", {
                        "cpu_max": 70,
                        "memory_max": 85,
                    }),
                    "max_concurrency": rules.get("max_concurrency_per_instance", 1),
                })

        # 上限適用
        if len(instances) > max_total:
            instances = instances[:max_total]

        logger.info(
            f"Discovered {len(instances)} eligible instances "
            f"on {account['name']} (account {account.get('account_id', '?')})"
        )
        return instances

    except Exception as e:
        logger.error(f"Instance discovery failed for {account['name']}: {e}")
        return []


def discover_all_instances() -> list:
    """
    全アカウントからインスタンスを発見。

    Returns:
        全アカウントの eligible インスタンスリスト
    """
    accounts = load_account_configs()
    all_instances = []

    for account in accounts:
        instances = discover_instances(account)
        all_instances.extend(instances)

    logger.info(f"Total discovered instances: {len(all_instances)}")
    return all_instances


def get_ssh_key_for_account(account_name: str) -> str:
    """
    Secrets Manager から SSH 秘密鍵を取得。

    SSH鍵は Secrets Manager に保存:
        skillrelay/production/scraper-ssh-{account_name}
    """
    global _ssh_keys_cache

    if account_name in _ssh_keys_cache:
        return _ssh_keys_cache[account_name]

    secret_name = f"skillrelay/production/scraper-ssh-{account_name}"
    try:
        sm = boto3.client("secretsmanager")
        response = sm.get_secret_value(SecretId=secret_name)
        key_pem = response["SecretString"]
        _ssh_keys_cache[account_name] = key_pem
        logger.info(f"SSH key loaded for account: {account_name}")
        return key_pem
    except Exception as e:
        logger.error(f"Failed to get SSH key for {account_name}: {e}")
        return ""


def _guess_ssh_user(instance: dict) -> str:
    """AMIやプラットフォームからSSHユーザーを推測。"""
    platform = instance.get("PlatformDetails", "Linux/UNIX")
    if "Windows" in platform:
        return "Administrator"

    # Amazon Linux / CentOS → ec2-user, Ubuntu → ubuntu
    image_id = instance.get("ImageId", "")
    # デフォルトは ec2-user (Amazon Linux ベースが多い)
    return "ec2-user"


def sync_discovered_to_db(instances: list):
    """
    発見したインスタンスを scraper_instances テーブルに同期。

    - 新しいインスタンス → INSERT
    - 既存インスタンス → UPDATE (host, status)
    - 見つからないインスタンス → status = 'offline'
    """
    from db import get_cursor
    import uuid

    with get_cursor() as cur:
        # 既存のアクティブインスタンスID
        cur.execute(
            "SELECT id, name, host FROM scraper_instances WHERE status IN ('active', 'offline')"
        )
        existing = {row["host"]: row for row in cur.fetchall()}

        discovered_hosts = set()

        for inst in instances:
            discovered_hosts.add(inst["host"])
            instance_id = f"si-{uuid.uuid4().hex[:12]}"

            cur.execute("""
                INSERT INTO scraper_instances
                    (id, name, host, port, ssh_user, ssh_key_secret_id,
                     runtime, max_concurrency, status, account_id, region,
                     resource_thresholds, capabilities, created_at, updated_at)
                VALUES (%s, %s, %s, 22, %s, %s, 'python', %s, 'active', %s, %s,
                        %s, %s, NOW(), NOW())
                ON CONFLICT (name) DO UPDATE SET
                    host = EXCLUDED.host,
                    ssh_user = EXCLUDED.ssh_user,
                    status = 'active',
                    max_concurrency = EXCLUDED.max_concurrency,
                    resource_thresholds = EXCLUDED.resource_thresholds,
                    updated_at = NOW()
            """, (
                instance_id,
                f"{inst['account_name']}-{inst['instance_id']}",
                inst["host"],
                inst["ssh_user"],
                f"skillrelay/production/scraper-ssh-{inst['account_name']}",
                inst["max_concurrency"],
                inst["account_id"],
                inst["region"],
                json.dumps(inst["resource_thresholds"]),
                json.dumps(["web_scrape", "csv_download", "pdf_download", "api"]),
            ))

        # 発見されなかったインスタンスを offline に
        for host, row in existing.items():
            if host not in discovered_hosts:
                cur.execute(
                    "UPDATE scraper_instances SET status = 'offline', updated_at = NOW() WHERE host = %s",
                    (host,),
                )

    logger.info(
        f"Synced {len(instances)} discovered instances to DB "
        f"({len(discovered_hosts)} active, "
        f"{len(existing) - len(discovered_hosts & set(existing.keys()))} offline)"
    )
