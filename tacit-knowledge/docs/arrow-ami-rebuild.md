# Arrow カスタム AMI 作成手順

## 概要

Arrow スポットインスタンス用の AMI を Amazon Linux 2 ベースで作り直す。
Docker / Chrome / Python 3.11 を事前にインストールし、スクレイパー環境をすぐに使える状態にする。

**方針:**
- AMI = 基盤環境（OS / Docker / Python / Chrome）— バージョン更新時のみ再作成
- setup.sh = 冪等なランタイムセットアップ（venv / pip / コードデプロイ）— AMI 再作成不要
- スクレイパーコード = S3 配布 or Lambda push — 随時更新可能

---

## 現行 → 新 AMI 比較

| 項目 | 現行 (AL 2018.03) | 新 (AL2) |
|------|---|---|
| AMI | `ami-0d0b02d158387406e` | 新規作成 |
| OS | Amazon Linux 2018.03 | Amazon Linux 2 |
| GLIBC | 2.17 | 2.26 |
| OpenSSL | 1.0.2k | 1.1.1 (Python 3.11 ビルド可) |
| Python 2.7 | あり | あり (delivery 用) |
| Python 3.11 | なし → ソースビルド必要 | AMI に事前ビルド |
| Docker | なし | AMI に事前インストール |
| Chrome | なし | AMI に事前インストール |
| init | SysV | systemd |

---

## 作成手順

### Step 1: ビルド用インスタンスを起動

```bash
# AL2 最新 AMI を確認
aws ec2 describe-images \
  --profile arrow --region ap-northeast-1 \
  --owners amazon \
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
  --query "Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]" \
  --output text

# 起動
aws ec2 run-instances \
  --profile arrow --region ap-northeast-1 \
  --image-id <AL2_AMI_ID> \
  --instance-type c5.2xlarge \
  --key-name arrow \
  --security-group-ids sg-00f1e46be5eb33d68 \
  --subnet-id subnet-51cb3719 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=arrow-ami-builder}]' \
  --query "Instances[0].InstanceId" --output text
```

### Step 2: SSH 接続

```bash
aws ec2 describe-instances \
  --profile arrow --region ap-northeast-1 \
  --instance-ids <INSTANCE_ID> \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text

ssh -i ~/.ssh/arrow.pem ec2-user@<PUBLIC_IP>
```

### Step 3: Delivery アプリ環境の移植

```bash
# ---------- ユーザー ----------
sudo useradd -u 501 app

# ---------- ディレクトリ ----------
sudo mkdir -p /usr/local/projects/arrow
sudo mkdir -p /usr/local/projects/venvs

# ---------- Delivery アプリ ----------
# Git clone (認証方法は Arrow 管理者に確認)
sudo yum install -y git
sudo -u app git clone <ARROW_REPO_URL> /usr/local/projects/arrow

# Python 2.7 virtualenv (AL2 は python2.7 標準搭載)
sudo pip install virtualenv
sudo -u app virtualenv /usr/local/projects/venvs/arrow
sudo -u app /usr/local/projects/venvs/arrow/bin/pip install \
  -r /usr/local/projects/arrow/delivery/requirements.txt

# gunicorn + gevent (delivery アプリ用)
sudo -u app /usr/local/projects/venvs/arrow/bin/pip install gunicorn gevent

# ---------- Supervisor ----------
sudo pip install supervisor
sudo mkdir -p /etc/supervisord.d /var/log/supervisor

sudo tee /etc/supervisord.d/arrow_delivery.ini << 'EOF'
[program:arrow_delivery]
command=/usr/local/projects/venvs/arrow/bin/gunicorn --worker-class gevent -w 4 --max-requests 5000 --max-requests-jitter 5000 -b 0.0.0.0:8080 main:application
directory=/usr/local/projects/arrow/delivery
environment=PYTHONPATH="/usr/local/projects/venvs/arrow/lib/python2.7/site-packages:/usr/local/projects/venvs/arrow/lib64/python2.7/site-packages",DELIVERY_SETTINGS_MODULE="arrow.settings.arrow_production"
user=app
autostart=true
autorestart=true
stdout_logfile_maxbytes=100MB
stderr_logfile_maxbytes=100MB
stdout_logfile=/var/log/supervisor/%(program_name)s.log
stderr_logfile=/var/log/supervisor/%(program_name)s.log
EOF

# Supervisor を systemd サービスとして登録
sudo tee /etc/systemd/system/supervisord.service << 'EOF'
[Unit]
Description=Supervisor process control system
After=network.target

[Service]
ExecStart=/usr/local/bin/supervisord -n -c /etc/supervisord.conf
ExecStop=/usr/local/bin/supervisorctl shutdown
ExecReload=/usr/local/bin/supervisorctl reload
KillMode=process
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable supervisord

# ---------- 起動時 git pull ----------
sudo tee /etc/init.d/arrow-update << 'INITEOF'
#!/bin/sh
# chkconfig: 2345 60 60
# description: arrow update
case "$1" in
 start)
       runuser -l app -c "cd /usr/local/projects/arrow && git pull"
       ;;
 stop)
       break ;;
  *) break ;;
esac
INITEOF
sudo chmod +x /etc/init.d/arrow-update
sudo chkconfig arrow-update on
```

### Step 4: Docker / Python 3.11 / Chrome のインストール

```bash
# ---------- Docker ----------
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
docker --version

# ---------- Python 3.11 (ソースビルド) ----------
# AL2 は OpenSSL 1.1.1 搭載 → OpenSSL ビルド不要
sudo yum install -y gcc openssl-devel bzip2-devel libffi-devel \
  zlib-devel readline-devel sqlite-devel wget make

cd /tmp
wget -q https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
tar xzf Python-3.11.9.tgz
cd Python-3.11.9

sudo mkdir -p /opt/scraper-agent
./configure --prefix=/opt/scraper-agent/python3 --with-ensurepip=install
make -j$(nproc)
sudo make altinstall

# 確認
/opt/scraper-agent/python3/bin/python3.11 --version
/opt/scraper-agent/python3/bin/python3.11 -c "import ssl; print(ssl.OPENSSL_VERSION)"

# クリーンアップ
sudo rm -rf /tmp/Python-3.11.9 /tmp/Python-3.11.9.tgz

# ---------- Chrome ----------
curl -sSL -o /tmp/chrome.rpm https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum localinstall -y /tmp/chrome.rpm
rm -f /tmp/chrome.rpm
google-chrome-stable --version
```

### Step 5: スクレイパー基盤環境の事前構築

```bash
# venv 作成 + pip パッケージインストール
sudo /opt/scraper-agent/python3/bin/python3.11 -m venv /opt/scraper-agent/.venv
sudo /opt/scraper-agent/.venv/bin/pip install --upgrade pip
sudo /opt/scraper-agent/.venv/bin/pip install psutil requests beautifulsoup4 lxml pdfplumber

# check_resources.py 配置
sudo tee /opt/scraper-agent/check_resources.py > /dev/null << 'PYEOF'
#!/usr/bin/env python3
"""CPU/memory/disk load as JSON."""
import json, psutil
print(json.dumps({
    "cpu_percent": psutil.cpu_percent(interval=1),
    "memory_percent": psutil.virtual_memory().percent,
    "memory_available_mb": round(psutil.virtual_memory().available / 1e6),
    "disk_percent": psutil.disk_usage("/").percent,
    "load_avg_1m": round(psutil.getloadavg()[0], 2),
}))
PYEOF
sudo chmod +x /opt/scraper-agent/check_resources.py

# 動作確認
/opt/scraper-agent/.venv/bin/python /opt/scraper-agent/check_resources.py
```

### Step 6: 全体動作確認

```bash
echo "=== OS ==="
cat /etc/system-release
openssl version

echo ""
echo "=== Delivery ==="
sudo supervisorctl status

echo ""
echo "=== Docker ==="
docker --version
sudo systemctl is-enabled docker

echo ""
echo "=== Python ==="
/opt/scraper-agent/python3/bin/python3.11 --version
/opt/scraper-agent/.venv/bin/python -c "import ssl; print(f'SSL: {ssl.OPENSSL_VERSION}')"
/opt/scraper-agent/.venv/bin/python -c "import psutil; print(f'psutil: {psutil.__version__}')"
/opt/scraper-agent/.venv/bin/python -c "import requests; print(f'requests: {requests.__version__}')"

echo ""
echo "=== Chrome ==="
google-chrome-stable --version

echo ""
echo "=== Resource Check ==="
/opt/scraper-agent/.venv/bin/python /opt/scraper-agent/check_resources.py
```

### Step 7: AMI 作成

```bash
# インスタンスを停止
aws ec2 stop-instances \
  --profile arrow --region ap-northeast-1 \
  --instance-ids <INSTANCE_ID>

aws ec2 wait instance-stopped \
  --profile arrow --region ap-northeast-1 \
  --instance-ids <INSTANCE_ID>

# AMI 作成
aws ec2 create-image \
  --profile arrow --region ap-northeast-1 \
  --instance-id <INSTANCE_ID> \
  --name "arrow-delivery-$(date +%Y%m%d)" \
  --description "Arrow delivery + scraper (AL2, Docker, Python 3.11, Chrome)" \
  --tag-specifications 'ResourceType=image,Tags=[{Key=Name,Value=arrow-delivery-latest}]' \
  --query "ImageId" --output text

# 完了待ち (5-10分)
aws ec2 wait image-available \
  --profile arrow --region ap-northeast-1 \
  --image-ids <NEW_AMI_ID>
```

### Step 8: スポットリクエストの AMI 更新

Arrow のスポットインスタンスがどう管理されているか (Launch Template / 直接リクエスト / ASG) によって手順が異なる。

```bash
# 現在のスポットリクエスト確認
aws ec2 describe-spot-instance-requests \
  --profile arrow --region ap-northeast-1 \
  --query "SpotInstanceRequests[?State=='active'].[SpotInstanceRequestId,LaunchSpecification.ImageId]" \
  --output table
```

### Step 9: クリーンアップ

```bash
aws ec2 terminate-instances \
  --profile arrow --region ap-northeast-1 \
  --instance-ids <INSTANCE_ID>
```

---

## setup.sh との関係

AMI に Docker / Python 3.11 / Chrome が入った状態で setup.sh を実行すると:

```
Phase 2: Docker     → [OK] Docker already installed ← スキップ
Phase 3: Python     → [OK] Python already installed (AMI) ← スキップ
Phase 4: Chrome     → [OK] Chrome already installed ← スキップ
Phase 5: Agent env  → [OK] Python venv already exists ← pip update のみ実行
Phase 6: Verification → 全チェック通過
```

**setup.sh は AMI 作成後も引き続き使う:**
- `--s3-package` でスクレイパーコードの更新デプロイ
- requirements.txt の変更追従 (pip install)
- 新しい AMI なしでも、素の AL2 インスタンスにゼロから環境構築可能 (フォールバック)

---

## ロールバック

新 AMI に問題があれば旧 AMI に即座に切り戻し可能。

| AMI | 用途 |
|-----|------|
| `ami-0d0b02d158387406e` | 旧 (AL 2018.03) — 削除しない |
| 新規 AMI ID | 新 (AL2) — 動作確認後に切り替え |
