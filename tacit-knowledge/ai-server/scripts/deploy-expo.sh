#!/bin/bash
set -euo pipefail

# ============================================================
# 展示会用 AppRunner デプロイスクリプト
# Usage: ./scripts/deploy-expo.sh [build|deploy|domain|teardown|status]
# ============================================================

AWS_ACCOUNT_ID="778389812638"
AWS_REGION="ap-northeast-1"
PROJECT_NAME="skillrelay"
ENVIRONMENT="production"
ECR_REPO="${PROJECT_NAME}-ai-server"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
EXPO_SERVICE_NAME="${PROJECT_NAME}-expo-ai-server"
EXPO_IMAGE_TAG="expo-latest"
CUSTOM_DOMAIN="ai-expo.taiziii.cloud"
PORT=3000

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================
# Step 1: Docker イメージをビルド & ECR プッシュ
# ============================================================
cmd_build() {
  log "ECR にログイン中..."
  aws ecr get-login-password --region ${AWS_REGION} \
    | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  log "Docker イメージをビルド中..."
  cd "$(dirname "$0")/.."
  docker build \
    -f Dockerfile.prod \
    --platform linux/amd64 \
    -t "${ECR_REPO}:${EXPO_IMAGE_TAG}" \
    .

  log "ECR にプッシュ中..."
  docker tag "${ECR_REPO}:${EXPO_IMAGE_TAG}" "${ECR_URI}:${EXPO_IMAGE_TAG}"
  docker push "${ECR_URI}:${EXPO_IMAGE_TAG}"

  log "ビルド & プッシュ完了: ${ECR_URI}:${EXPO_IMAGE_TAG}"
}

# ============================================================
# Step 2: IAM ロール ARN を取得
# ============================================================
get_role_arns() {
  ACCESS_ROLE_ARN=$(aws cloudformation list-exports --region ${AWS_REGION} \
    --query "Exports[?Name=='${PROJECT_NAME}-${ENVIRONMENT}-ai-server-apprunner-access-role-arn'].Value" \
    --output text)

  INSTANCE_ROLE_ARN=$(aws cloudformation list-exports --region ${AWS_REGION} \
    --query "Exports[?Name=='${PROJECT_NAME}-${ENVIRONMENT}-ai-server-apprunner-instance-role-arn'].Value" \
    --output text)

  if [ -z "$ACCESS_ROLE_ARN" ] || [ -z "$INSTANCE_ROLE_ARN" ]; then
    err "IAM ロール ARN の取得に失敗しました"
    exit 1
  fi

  log "Access Role: ${ACCESS_ROLE_ARN}"
  log "Instance Role: ${INSTANCE_ROLE_ARN}"
}

# ============================================================
# Step 3: AppRunner サービス作成
# ============================================================
cmd_deploy() {
  get_role_arns

  # 既存サービスの確認
  EXISTING=$(aws apprunner list-services --region ${AWS_REGION} \
    --query "ServiceSummaryList[?ServiceName=='${EXPO_SERVICE_NAME}'].ServiceArn" \
    --output text 2>/dev/null || echo "")

  if [ -n "$EXISTING" ] && [ "$EXISTING" != "None" ]; then
    log "既存サービスを更新中: ${EXPO_SERVICE_NAME}"
    aws apprunner update-service \
      --region ${AWS_REGION} \
      --service-arn "${EXISTING}" \
      --source-configuration "{
        \"ImageRepository\": {
          \"ImageIdentifier\": \"${ECR_URI}:${EXPO_IMAGE_TAG}\",
          \"ImageRepositoryType\": \"ECR\",
          \"ImageConfiguration\": {
            \"Port\": \"${PORT}\",
            \"RuntimeEnvironmentSecrets\": {
              \"OPENAI_API_KEY\": \"/${PROJECT_NAME}/${ENVIRONMENT}/OPENAI_API_KEY\",
              \"ANTHROPIC_API_KEY\": \"/${PROJECT_NAME}/${ENVIRONMENT}/ANTHROPIC_API_KEY\"
            },
            \"RuntimeEnvironmentVariables\": {
              \"NODE_ENV\": \"production\"
            }
          }
        },
        \"AutoDeploymentsEnabled\": false,
        \"AuthenticationConfiguration\": {
          \"AccessRoleArn\": \"${ACCESS_ROLE_ARN}\"
        }
      }" \
      --instance-configuration "{
        \"Cpu\": \"0.25 vCPU\",
        \"Memory\": \"0.5 GB\",
        \"InstanceRoleArn\": \"${INSTANCE_ROLE_ARN}\"
      }" \
      --output json

    log "サービス更新開始: ${EXPO_SERVICE_NAME}"
  else
    log "新規サービスを作成中: ${EXPO_SERVICE_NAME}"
    aws apprunner create-service \
      --region ${AWS_REGION} \
      --service-name "${EXPO_SERVICE_NAME}" \
      --source-configuration "{
        \"ImageRepository\": {
          \"ImageIdentifier\": \"${ECR_URI}:${EXPO_IMAGE_TAG}\",
          \"ImageRepositoryType\": \"ECR\",
          \"ImageConfiguration\": {
            \"Port\": \"${PORT}\",
            \"RuntimeEnvironmentSecrets\": {
              \"OPENAI_API_KEY\": \"/${PROJECT_NAME}/${ENVIRONMENT}/OPENAI_API_KEY\",
              \"ANTHROPIC_API_KEY\": \"/${PROJECT_NAME}/${ENVIRONMENT}/ANTHROPIC_API_KEY\"
            },
            \"RuntimeEnvironmentVariables\": {
              \"NODE_ENV\": \"production\"
            }
          }
        },
        \"AutoDeploymentsEnabled\": false,
        \"AuthenticationConfiguration\": {
          \"AccessRoleArn\": \"${ACCESS_ROLE_ARN}\"
        }
      }" \
      --instance-configuration "{
        \"Cpu\": \"0.25 vCPU\",
        \"Memory\": \"0.5 GB\",
        \"InstanceRoleArn\": \"${INSTANCE_ROLE_ARN}\"
      }" \
      --health-check-configuration "{
        \"Protocol\": \"HTTP\",
        \"Path\": \"/api/health\",
        \"Interval\": 10,
        \"Timeout\": 5,
        \"HealthyThreshold\": 1,
        \"UnhealthyThreshold\": 10
      }" \
      --output json

    log "サービス作成開始: ${EXPO_SERVICE_NAME}"
  fi

  log "デプロイ状態を確認するには: $0 status"
}

# ============================================================
# Step 4: カスタムドメイン関連付け & Route 53 設定
# ============================================================
cmd_domain() {
  SERVICE_ARN=$(aws apprunner list-services --region ${AWS_REGION} \
    --query "ServiceSummaryList[?ServiceName=='${EXPO_SERVICE_NAME}'].ServiceArn" \
    --output text)

  if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" = "None" ]; then
    err "サービスが見つかりません: ${EXPO_SERVICE_NAME}"
    exit 1
  fi

  log "カスタムドメインを関連付け中: ${CUSTOM_DOMAIN}"
  RESULT=$(aws apprunner associate-custom-domain \
    --region ${AWS_REGION} \
    --service-arn "${SERVICE_ARN}" \
    --domain-name "${CUSTOM_DOMAIN}" \
    --enable-www-subdomain=false \
    --output json 2>&1) || true

  if echo "$RESULT" | grep -q "already associated"; then
    warn "ドメインは既に関連付けされています"
  else
    echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
  fi

  log ""
  log "=== DNS 設定手順 ==="
  log "AppRunner がCNAME検証レコードを要求します。"
  log "以下のコマンドで検証レコードを確認してください:"
  log ""
  echo "  aws apprunner describe-custom-domains --region ${AWS_REGION} --service-arn \"${SERVICE_ARN}\" --output json"
  log ""
  log "表示された CertificateValidationRecords の各レコードを Route 53 に追加してください。"
  log ""
  log "検証完了後、以下のCNAMEレコードも追加:"
  log "  ${CUSTOM_DOMAIN} → AppRunnerのServiceUrl"
  log ""

  # Route 53 ホストゾーンID取得
  HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='taiziii.cloud.'].Id" \
    --output text | sed 's|/hostedzone/||')

  if [ -n "$HOSTED_ZONE_ID" ] && [ "$HOSTED_ZONE_ID" != "None" ]; then
    log "Route 53 ホストゾーン検出: ${HOSTED_ZONE_ID}"

    # AppRunner Service URL 取得
    SERVICE_URL=$(aws apprunner describe-service --region ${AWS_REGION} \
      --service-arn "${SERVICE_ARN}" \
      --query "Service.ServiceUrl" \
      --output text)

    log "AppRunner Service URL: ${SERVICE_URL}"

    # 検証レコード取得
    log "検証レコードを Route 53 に自動追加中..."
    CERT_RECORDS=$(aws apprunner describe-custom-domains --region ${AWS_REGION} \
      --service-arn "${SERVICE_ARN}" \
      --query "CustomDomains[?DomainName=='${CUSTOM_DOMAIN}'].CertificateValidationRecords[]" \
      --output json)

    # 検証CNAMEレコードを追加
    CHANGES="[]"
    for row in $(echo "$CERT_RECORDS" | python3 -c "
import sys, json
records = json.load(sys.stdin)
for r in records:
    print(f\"{r['Name']}|{r['Value']}\")
" 2>/dev/null); do
      CNAME_NAME=$(echo "$row" | cut -d'|' -f1)
      CNAME_VALUE=$(echo "$row" | cut -d'|' -f2)
      CHANGES=$(echo "$CHANGES" | python3 -c "
import sys, json
changes = json.load(sys.stdin)
changes.append({
    'Action': 'UPSERT',
    'ResourceRecordSet': {
        'Name': '${CNAME_NAME}',
        'Type': 'CNAME',
        'TTL': 300,
        'ResourceRecords': [{'Value': '${CNAME_VALUE}'}]
    }
})
print(json.dumps(changes))
")
    done

    # メインドメインのCNAMEも追加
    CHANGES=$(echo "$CHANGES" | python3 -c "
import sys, json
changes = json.load(sys.stdin)
changes.append({
    'Action': 'UPSERT',
    'ResourceRecordSet': {
        'Name': '${CUSTOM_DOMAIN}',
        'Type': 'CNAME',
        'TTL': 300,
        'ResourceRecords': [{'Value': '${SERVICE_URL}'}]
    }
})
print(json.dumps(changes))
")

    CHANGE_BATCH="{\"Changes\": ${CHANGES}}"

    aws route53 change-resource-record-sets \
      --hosted-zone-id "${HOSTED_ZONE_ID}" \
      --change-batch "${CHANGE_BATCH}" \
      --output json

    log "Route 53 レコード追加完了"
    log "SSL証明書の検証が完了するまで数分〜最大48時間かかります。"
  else
    warn "taiziii.cloud のホストゾーンが見つかりません。手動でDNS設定してください。"
  fi
}

# ============================================================
# ステータス確認
# ============================================================
cmd_status() {
  SERVICE_ARN=$(aws apprunner list-services --region ${AWS_REGION} \
    --query "ServiceSummaryList[?ServiceName=='${EXPO_SERVICE_NAME}'].ServiceArn" \
    --output text 2>/dev/null || echo "")

  if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" = "None" ]; then
    warn "サービスが見つかりません: ${EXPO_SERVICE_NAME}"
    return
  fi

  log "=== AppRunner サービス状態 ==="
  aws apprunner describe-service --region ${AWS_REGION} \
    --service-arn "${SERVICE_ARN}" \
    --query "Service.{Name:ServiceName,Status:Status,URL:ServiceUrl,Created:CreatedAt,Updated:UpdatedAt}" \
    --output table

  log ""
  log "=== カスタムドメイン状態 ==="
  aws apprunner describe-custom-domains --region ${AWS_REGION} \
    --service-arn "${SERVICE_ARN}" \
    --query "CustomDomains[].{Domain:DomainName,Status:Status}" \
    --output table 2>/dev/null || warn "カスタムドメイン未設定"
}

# ============================================================
# 展示会後: サービス削除
# ============================================================
cmd_teardown() {
  SERVICE_ARN=$(aws apprunner list-services --region ${AWS_REGION} \
    --query "ServiceSummaryList[?ServiceName=='${EXPO_SERVICE_NAME}'].ServiceArn" \
    --output text 2>/dev/null || echo "")

  if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" = "None" ]; then
    warn "サービスが見つかりません: ${EXPO_SERVICE_NAME}"
    return
  fi

  echo ""
  warn "以下のリソースを削除します:"
  echo "  - AppRunner: ${EXPO_SERVICE_NAME}"
  echo "  - カスタムドメイン: ${CUSTOM_DOMAIN}"
  echo ""
  read -p "本当に削除しますか？ (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    log "キャンセルしました"
    return
  fi

  # カスタムドメイン解除
  log "カスタムドメインを解除中..."
  aws apprunner disassociate-custom-domain \
    --region ${AWS_REGION} \
    --service-arn "${SERVICE_ARN}" \
    --domain-name "${CUSTOM_DOMAIN}" 2>/dev/null || true

  # Route 53 レコード削除
  HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='taiziii.cloud.'].Id" \
    --output text | sed 's|/hostedzone/||')

  if [ -n "$HOSTED_ZONE_ID" ] && [ "$HOSTED_ZONE_ID" != "None" ]; then
    log "Route 53 レコードを削除中..."
    # メインCNAMEのみ削除（検証レコードはAppRunnerが管理）
    SERVICE_URL=$(aws apprunner describe-service --region ${AWS_REGION} \
      --service-arn "${SERVICE_ARN}" \
      --query "Service.ServiceUrl" \
      --output text)

    aws route53 change-resource-record-sets \
      --hosted-zone-id "${HOSTED_ZONE_ID}" \
      --change-batch "{
        \"Changes\": [{
          \"Action\": \"DELETE\",
          \"ResourceRecordSet\": {
            \"Name\": \"${CUSTOM_DOMAIN}\",
            \"Type\": \"CNAME\",
            \"TTL\": 300,
            \"ResourceRecords\": [{\"Value\": \"${SERVICE_URL}\"}]
          }
        }]
      }" 2>/dev/null || warn "Route 53 レコード削除スキップ"
  fi

  # サービス削除
  log "AppRunner サービスを削除中..."
  aws apprunner delete-service \
    --region ${AWS_REGION} \
    --service-arn "${SERVICE_ARN}" \
    --output json

  log "削除完了。課金は停止されます。"
}

# ============================================================
# ANTHROPIC_API_KEY を Parameter Store に追加
# ============================================================
cmd_setup_params() {
  log "=== Parameter Store 設定 ==="

  # 既存のキーを確認
  EXISTING_ANTHROPIC=$(aws ssm get-parameter \
    --name "/${PROJECT_NAME}/${ENVIRONMENT}/ANTHROPIC_API_KEY" \
    --region ${AWS_REGION} \
    --query "Parameter.Value" \
    --output text 2>/dev/null || echo "NOT_FOUND")

  if [ "$EXISTING_ANTHROPIC" = "NOT_FOUND" ]; then
    warn "ANTHROPIC_API_KEY が Parameter Store に存在しません"
    read -p "ANTHROPIC_API_KEY を入力してください: " API_KEY
    aws ssm put-parameter \
      --name "/${PROJECT_NAME}/${ENVIRONMENT}/ANTHROPIC_API_KEY" \
      --type SecureString \
      --value "${API_KEY}" \
      --region ${AWS_REGION} \
      --output json
    log "ANTHROPIC_API_KEY を登録しました"
  else
    log "ANTHROPIC_API_KEY は登録済みです"
  fi

  # OPENAI_API_KEY の確認
  EXISTING_OPENAI=$(aws ssm get-parameter \
    --name "/${PROJECT_NAME}/${ENVIRONMENT}/OPENAI_API_KEY" \
    --region ${AWS_REGION} \
    --query "Parameter.Value" \
    --output text 2>/dev/null || echo "NOT_FOUND")

  if [ "$EXISTING_OPENAI" = "NOT_FOUND" ]; then
    warn "OPENAI_API_KEY が Parameter Store に存在しません"
  else
    log "OPENAI_API_KEY は登録済みです"
  fi
}

# ============================================================
# メイン
# ============================================================
case "${1:-help}" in
  build)
    cmd_build
    ;;
  deploy)
    cmd_deploy
    ;;
  domain)
    cmd_domain
    ;;
  status)
    cmd_status
    ;;
  teardown)
    cmd_teardown
    ;;
  setup-params)
    cmd_setup_params
    ;;
  all)
    cmd_build
    cmd_deploy
    log "デプロイが完了するまで待機中..."
    log "サービスが RUNNING になったら、'$0 domain' を実行してください"
    ;;
  help|*)
    echo ""
    echo "展示会用 AppRunner デプロイスクリプト"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup-params  ANTHROPIC_API_KEY を Parameter Store に登録"
    echo "  build         Docker イメージをビルド & ECR にプッシュ"
    echo "  deploy        AppRunner サービスを作成/更新"
    echo "  domain        カスタムドメイン & Route 53 DNS 設定"
    echo "  status        デプロイ状態を確認"
    echo "  all           build + deploy を一括実行"
    echo "  teardown      展示会後にサービスを削除（課金停止）"
    echo ""
    echo "推奨実行順:"
    echo "  1. $0 setup-params    # 初回のみ"
    echo "  2. $0 build"
    echo "  3. $0 deploy"
    echo "  4. $0 status          # RUNNING になるまで待つ"
    echo "  5. $0 domain"
    echo "  6. $0 status          # ドメイン検証確認"
    echo ""
    echo "展示会終了後:"
    echo "  $0 teardown"
    echo ""
    ;;
esac
