# プレビュー環境 運用ガイド

## 概要

プレビュー環境は `mock/*` ブランチにpushすると自動的にデプロイされます。各プレビュー環境は独立したPostgreSQLデータベース、SQSキュー、S3バケット、App Runnerサービスを持ち、本番環境に影響を与えません。

ビルド・デプロイは **EC2 上の self-hosted runner プール（3台）** で実行されます（GitHub-hosted runner の課金回避）。ランナーは **オンデマンド起動** — 普段は全台停止状態で、push時にLambdaが全台自動起動し、GitHubが空きランナーにジョブを分散割り当てします。完了後に各ランナーが自動停止します。

### アーキテクチャ

```
mock/* ブランチにpush（最大3ブランチ同時対応）
  ↓
GitHub Actions: workflow_job queued
  ↓
GitHub webhook → API Gateway → Lambda → 全停止EC2を起動 (~30秒)
  ↓
3台の Self-hosted Runner (EC2 t3.medium) が再接続
  ↓
GitHub が空きランナーにジョブを自動割り当て（並列実行）
  ↓
  ├── Docker イメージビルド (EBS上のローカルキャッシュ使用) → ECR push
  ├── PostgreSQL DB作成 (skillrelay_mock_feature_name)
  ├── CloudFormation スタック作成/更新
  │     ├── S3 バケット (skillrelay-preview-{slug})
  │     ├── SQS キュー + DLQ (skillrelay-mock-{slug}-document-processing)
  │     ├── App Runner: Core (Rails)
  │     └── App Runner: AI Server (Node.js)
  └── App Runner 再デプロイ
  ↓
各ランナー: ジョブ完了後 5分間アイドル → idle-monitor → EC2 自動停止
```

> **並列デプロイ**: 3台のランナープールにより、最大3ブランチを同時にデプロイ可能です。同一ブランチへの複数pushは `concurrency` グループで直列実行されます。
> **コスト**: EC2は使用時のみ課金。停止中はEBS 3台分 (~$9/月) のみ。

### リソース構成

| リソース | 命名規則 | 例 |
|---|---|---|
| CloudFormation Stack | `skillrelay-mock-{slug}` | `skillrelay-mock-suntory` |
| PostgreSQL Database | `skillrelay_mock_{slug_underscore}` | `skillrelay_mock_suntory` |
| S3 Bucket | `skillrelay-preview-{slug}` | `skillrelay-preview-suntory` |
| SQS Queue | `skillrelay-mock-{slug}-document-processing` | `skillrelay-mock-suntory-document-processing` |
| SQS DLQ | `skillrelay-mock-{slug}-document-processing-dlq` | `skillrelay-mock-suntory-document-processing-dlq` |
| ECR Image Tag | `mock-{slug}` | `mock-suntory` |
| Core App Runner | `skillrelay-mock-{slug}-core` | `skillrelay-mock-suntory-core` |
| AI Server App Runner | `skillrelay-mock-{slug}-ai-server` | `skillrelay-mock-suntory-ai-server` |

## プレビュー環境の作成

### 1. mockブランチを作成してpush

```bash
# mainから新しいmockブランチを作成
git checkout main
git pull origin main
git checkout -b mock/feature-name

# 開発・コミット後にpush
git push origin mock/feature-name
```

push後、GitHub Actions の "Deploy Preview Environment" ワークフローが自動実行されます。

### 2. デプロイの確認

```bash
# ワークフロー実行状況を確認
gh run list --branch mock/feature-name --workflow "Deploy Preview Environment"

# 実行中のログを確認
gh run watch {run-id}
```

### 3. URLの確認

デプロイ完了後、GitHub Actions の Step Summary に URL が表示されます。

```bash
# CloudFormation OutputsからURLを取得
aws cloudformation describe-stacks \
  --stack-name skillrelay-mock-feature-name \
  --query "Stacks[0].Outputs"
```

## プレビュー環境の更新

`mock/**` ブランチにpushすると自動的に更新されます。変更があったサービスのみリビルド・再デプロイされます。

```bash
# 変更をコミットしてpush
git add .
git commit -m "feat: 変更内容"
git push origin mock/feature-name
```

### mainの変更を取り込む

```bash
git checkout mock/feature-name
git merge origin/main
git push origin mock/feature-name
```

> **重要**: インフラ関連ファイル（`.github/workflows/`, `cloudformation/`, `Dockerfile*`, `docker-entrypoint`）はmainで管理し、mockブランチで独自に変更しないでください。差分があるとデプロイ失敗の原因になります。

## プレビュー環境の破棄

### GitHub Actions から実行

1. GitHub の Actions タブを開く
2. "Destroy Preview Environment" ワークフローを選択
3. "Run workflow" をクリック
4. `slug` にプレビュー環境のslugを入力（例: `feature-name`）
5. 実行

```bash
# CLI から実行
gh workflow run "Destroy Preview Environment" -f slug=feature-name
```

### 破棄される内容

1. S3 バケット内のオブジェクト（`skillrelay-preview-{slug}`）
2. CloudFormation スタック（App Runner サービス、SQS キュー、S3 バケット含む）
3. PostgreSQL データベース（`skillrelay_mock_{slug}`）
4. ECR イメージ（`mock-{slug}` タグ）

## トラブルシューティング

### デプロイが失敗する

#### CloudFormation スタックが ROLLBACK_COMPLETE

前回のデプロイ失敗でスタックが中途半端な状態になっている。ワークフローに自動クリーンアップが組み込まれているため、再pushすれば自動的に削除・再作成されます。

手動で対応する場合:

```bash
aws cloudformation delete-stack --stack-name skillrelay-mock-{slug}
aws cloudformation wait stack-delete-complete --stack-name skillrelay-mock-{slug}
# その後、mockブランチに再push
```

#### App Runner サービスが起動しない

**よくある原因:**

1. **SSMパラメータの解決失敗**: `RuntimeEnvironmentSecrets` に指定したSSMパラメータが存在しない、またはApp RunnerのIAMロールにアクセス権がない
2. **ヘルスチェック失敗**: アプリケーションの起動に時間がかかり、ヘルスチェックがタイムアウト
3. **AI Server未起動**: CoreはAI Serverに `DependsOn` しているため、AI Serverが先に起動する必要がある

**確認手順:**

```bash
# CloudFormation イベントを確認
aws cloudformation describe-stack-events \
  --stack-name skillrelay-mock-{slug} \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" \
  --output table

# App Runner サービスの状態を確認
aws apprunner list-services \
  --query "ServiceSummaryList[?contains(ServiceName, 'mock-{slug}')]"
```

#### 2つのデプロイが同時に実行される

`concurrency` グループにより、ジョブは直列実行されます。短時間に複数回pushしても、先のジョブが完了するまで後のジョブは待機します（キャンセルされません）。

### ログインできない

1. DB移行が完了しているか確認（`db:prepare` の実行）
2. seedデータが投入されているか確認（`db:seed_fu` の実行）
3. `PREVIEW_ENV=true` が設定されているか確認

### データをリセットしたい

プレビュー環境のデータを初期状態に戻すには:

1. destroy ワークフローで環境を削除
2. mockブランチに再pushして再作成

## 環境変数一覧

### Core (Rails)

| 変数名 | 値 | 説明 |
|---|---|---|
| `RAILS_ENV` | `production` | Rails環境 |
| `POSTGRES_HOST` | (RDS endpoint) | DB接続先 |
| `POSTGRES_USER` | `postgres` | DBユーザー |
| `POSTGRES_DB` | `skillrelay_mock_{slug}` | プレビュー専用DB |
| `PREVIEW_ENV` | `true` | プレビュー環境フラグ（seed制御） |
| `ADMIN_EMAIL` | `preview@skillrelay.ai` | プレビュー管理者 |
| `ADMIN_PASSWORD` | `Preview@2026` | プレビュー管理者パスワード |
| `AI_SERVER_URL` | (App Runner URL) | AI Serverへの接続先 |

### AI Server (Node.js)

| 変数名 | 値 | 説明 |
|---|---|---|
| `NODE_ENV` | `production` | Node環境 |
| `POSTGRES_HOST` | (RDS endpoint) | DB接続先 |
| `POSTGRES_DB` | `skillrelay_mock_{slug}` | プレビュー専用DB |

### シークレット（SSM Parameter Store）

| 変数名 | SSMパス |
|---|---|
| `POSTGRES_PASSWORD` | `/skillrelay/production/POSTGRES_PASSWORD` |
| `RAILS_MASTER_KEY` | `/skillrelay/production/RAILS_MASTER_KEY` |
| `OPENAI_API_KEY` | `/skillrelay/production/OPENAI_API_KEY` |
| `COHERE_API_KEY` | `/skillrelay/production/COHERE_API_KEY` |

> **注意**: `CLOUDFRONT_PRIVATE_KEY` はプレビュー環境のApp Runnerアクセスロールでは解決できないため、CFテンプレートに追加しないでください。必要な場合はIAMロールの権限追加が先に必要です。

## 注意事項

1. **インフラファイルはmainで管理**: `.github/workflows/`, `cloudformation/`, `Dockerfile*`, `docker-entrypoint` はmainブランチで変更し、mockブランチにmergeしてください
2. **本番リソースへの影響なし**: 各プレビュー環境は独立したデータベース、SQSキュー、S3バケットを使用しており、本番環境には影響しません
3. **コスト**: 同一RDSインスタンス上の論理データベースなので追加DB料金は $0。SQS・S3もほぼ無料。App Runnerは起動中のインスタンス分の料金が発生します
4. **不要な環境は破棄**: 使わなくなったプレビュー環境は速やかにdestroyしてください（App Runnerの課金を止めるため）
5. **S3の自動有効期限**: プレビュー用S3バケットには30日の自動有効期限が設定されています

## プレビュー環境一覧の確認

デプロイ済みのプレビュー環境を一覧表示するには：

```bash
gh workflow run "List Preview Environments"
```

GitHub Actions の Step Summary に、全プレビュー環境の一覧（Slug、Core URL、AI Server URL、ステータス、最終更新日）が表示されます。

## Self-hosted Runner

### 概要

プレビューデプロイは EC2 上の self-hosted runner プール（3台）で実行されます。GitHub-hosted runner (`ubuntu-latest`) の課金を回避しつつ、EBS 上の永続 Docker キャッシュによりビルド時間も短縮されています。

**ランナーはオンデマンド起動です**: 普段は全3台の EC2 が停止状態（EBSのみ課金 ~$9/月）で、`mock/*` ブランチにpushすると GitHub webhook → Lambda → 全停止EC2起動 の流れで自動的にランナーが立ち上がります。GitHubが空きランナーにジョブを自動分散し、各ランナーはジョブ完了後5分でアイドル検知し自動停止します。

| 項目 | 値 |
|------|-----|
| 台数 | 3台 (最大3並列デプロイ) |
| インスタンス | t3.medium (2 vCPU, 4 GB RAM, 4 GB swap) |
| OS | Ubuntu 22.04 LTS |
| EBS | 30 GB gp3 × 3台 (停止中も保持) |
| ランナー名 | `skillrelay-runner-{instance-id末尾8桁}` (自動生成) |
| ラベル | `self-hosted`, `linux`, `x64`, `ec2` |
| CloudFormation | `12-self-hosted-runner.yml` (Launch Template + 3 Instance) |
| 自動起動 | GitHub webhook → API Gateway → Lambda → 全停止インスタンス起動 |
| 自動停止 | idle-monitor.sh (5分アイドルで `shutdown -h now`) |

### ランナー状態の確認

```bash
# GitHub API でランナー一覧を確認（3台表示される）
gh api repos/emc-kk/skillrelay/actions/runners \
  --jq '.runners[] | {name: .name, status: .status}'

# 全ランナーEC2の状態を確認
aws ec2 describe-instances \
  --filters "Name=tag:Role,Values=github-runner" \
  --query "Reservations[].Instances[].{Id:InstanceId,Name:Tags[?Key=='Name']|[0].Value,State:State.Name}" \
  --output table

# ワークフロー実行待ちの確認
gh run list --workflow "Deploy Preview Environment" --status queued
```

### 手動でランナーを起動/停止

```bash
# 全ランナーEC2のインスタンスIDを取得
INSTANCE_IDS=$(aws ec2 describe-instances \
  --filters "Name=tag:Role,Values=github-runner" "Name=instance-state-name,Values=stopped" \
  --query "Reservations[].Instances[].InstanceId" --output text)

# 全台手動起動
aws ec2 start-instances --instance-ids $INSTANCE_IDS

# 全台手動停止
RUNNING_IDS=$(aws ec2 describe-instances \
  --filters "Name=tag:Role,Values=github-runner" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].InstanceId" --output text)
aws ec2 stop-instances --instance-ids $RUNNING_IDS
```

### SSH アクセス

Moriwaki VPN (`185.221.134.93`) または ITS Office (`118.70.161.162`) からのみ SSH 可能です。

```bash
# 起動中のランナーのPublic IPを確認
aws ec2 describe-instances \
  --filters "Name=tag:Role,Values=github-runner" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].{Name:Tags[?Key=='Name']|[0].Value,IP:PublicIpAddress}" \
  --output table

# SSH 接続
ssh ubuntu@<runner-ip>
```

> **注意**: SSH中にidle-monitorがシャットダウンする可能性があります。長時間のメンテナンス時は `sudo systemctl stop idle-monitor` で一時停止してください。

### ランナーの再起動

```bash
ssh ubuntu@<runner-ip>
sudo systemctl restart actions.runner.emc-kk-skillrelay.skillrelay-ec2-runner.service
sudo systemctl status actions.runner.emc-kk-skillrelay.skillrelay-ec2-runner.service
```

### トラブルシューティング

#### Runner が offline (EC2 停止中)

EC2が停止中の場合、ランナーは offline と表示されます。これは正常な動作です。`mock/*` ブランチにpushすればwebhookで自動起動します。

手動で起動したい場合は「手動でランナーを起動/停止」を参照してください。

#### Runner が offline (EC2 起動中なのに)

```bash
# SSH でサービス状態を確認
ssh ubuntu@<runner-ip>
sudo systemctl status actions.runner.emc-kk-skillrelay.skillrelay-ec2-runner.service

# ログを確認
tail -100 /opt/actions-runner/_diag/Runner_*.log
```

#### webhook でランナーが起動しない

```bash
# Lambda のログを確認
aws logs tail /aws/lambda/skillrelay-production-runner-starter --since 30m

# webhook URL を確認
aws cloudformation describe-stacks \
  --stack-name skillrelay-runner \
  --query "Stacks[0].Outputs[?OutputKey=='WebhookUrl'].OutputValue" \
  --output text

# GitHub webhook の配信履歴を確認
# GitHub > Settings > Webhooks > Recent Deliveries
```

#### ディスク容量不足

```bash
ssh ubuntu@<runner-ip>
df -h
# 手動クリーンアップ
docker system prune -af
```

> 通常は毎日 AM 3:00 (JST) に自動クリーンアップが実行されます。

#### Docker ビルドで OOM

```bash
ssh ubuntu@<runner-ip>
dmesg | grep -i oom
free -h
```

デフォルトは t3.medium (4GB + 4GB swap) です。それでも不足する場合は CloudFormation パラメータの `InstanceType` を `t3.large` に変更してスタックを更新してください。

#### ランナーの再登録

GitHub Settings > Actions > Runners で古いランナーを削除してから:

```bash
ssh ubuntu@<runner-ip>
cd /opt/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
sudo -u ubuntu ./config.sh remove --token $(curl -s -X POST \
  -H "Authorization: Bearer $(aws ssm get-parameter --name /skillrelay/production/GITHUB_RUNNER_PAT --with-decryption --query 'Parameter.Value' --output text)" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/emc-kk/skillrelay/actions/runners/remove-token | jq -r .token)

# 再登録
REG_TOKEN=$(curl -s -X POST \
  -H "Authorization: Bearer $(aws ssm get-parameter --name /skillrelay/production/GITHUB_RUNNER_PAT --with-decryption --query 'Parameter.Value' --output text)" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/emc-kk/skillrelay/actions/runners/registration-token | jq -r .token)
sudo -u ubuntu ./config.sh --url https://github.com/emc-kk/skillrelay --token "$REG_TOKEN" --name skillrelay-ec2-runner --labels self-hosted,linux,x64,ec2 --unattended --replace
sudo ./svc.sh install ubuntu
sudo ./svc.sh start
```
