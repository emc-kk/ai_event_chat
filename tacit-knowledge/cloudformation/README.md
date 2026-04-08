# CloudFormation デプロイ手順

```bash
export PROJECT_NAME=skillrelay ENVIRONMENT=(development | staging | production)
```

## 01-network.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-network \
  --template-file templates/01-network.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}
```

## 02-database.yml

```bash
POSTGRES_PASSWORD=
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-database \
  --template-file templates/02-database.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT} DatabasePassword=${POSTGRES_PASSWORD}
```

## 03-ecr.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-ecr \
  --template-file templates/03-ecr.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME}
```

## 04-iam.yml

```bash
GITHUB_REPO=emc-kk/skillrelay
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-iam \
  --template-file templates/04-iam.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT} GitHubRepo=${GITHUB_REPO} \
  --capabilities CAPABILITY_NAMED_IAM
```

## 05-iam-dev.yml (Local Development)

```bash
aws cloudformation deploy \
  --stack-name skillrelay-iam-dev \
  --template-file templates/05-iam-dev.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

## 06-apprunner-shared.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-apprunner-shared \
  --template-file templates/06-apprunner-shared.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}
```

## 07-apprunner.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-apprunner \
  --template-file templates/07-apprunner.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}
```

## 08-sqs.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-sqs \
  --template-file templates/08-sqs.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}
```

## 09-ecs.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-ecs \
  --template-file templates/09-ecs.yml \
  --parameter-overrides ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}
```

## 10-cloudfront.yml

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-cloudfront \
  --template-file templates/10-cloudfront.yml \
  --parameter-overrides \
    ProjectName=${PROJECT_NAME} \
    Environment=${ENVIRONMENT} \
    "CloudFrontPublicKeyPem=$(cat public_key.pem)"
```

## 12-self-hosted-runner.yml

GitHub Actions の self-hosted runner を EC2 上に構築します。`mock/*` ブランチのプレビューデプロイに使用されます。オンデマンド起動（webhook → Lambda → EC2 start、完了後に自動停止）。

### 前提

1. GitHub PAT を SSM Parameter Store に保存:

```bash
# Fine-grained PAT: emc-kk/skillrelay リポジトリに Administration: write 権限
aws ssm put-parameter \
  --name /${PROJECT_NAME}/${ENVIRONMENT}/GITHUB_RUNNER_PAT \
  --type SecureString \
  --value "ghp_xxxxxxxxxxxx"
```

2. GitHub Webhook Secret を SSM に保存:

```bash
aws ssm put-parameter \
  --name /${PROJECT_NAME}/${ENVIRONMENT}/GITHUB_WEBHOOK_SECRET \
  --type SecureString \
  --value "$(openssl rand -hex 32)"
```

3. (任意) SSH 用 EC2 Key Pair を作成:

```bash
aws ec2 create-key-pair --key-name skillrelay-runner \
  --query 'KeyMaterial' --output text > skillrelay-runner.pem
chmod 400 skillrelay-runner.pem
```

### デプロイ

```bash
aws cloudformation deploy \
  --stack-name ${PROJECT_NAME}-runner \
  --template-file templates/12-self-hosted-runner.yml \
  --parameter-overrides \
    ProjectName=${PROJECT_NAME} \
    Environment=${ENVIRONMENT} \
    KeyName=skillrelay-runner \
  --capabilities CAPABILITY_NAMED_IAM
```

### Webhook 登録

```bash
# Webhook URL を取得
WEBHOOK_URL=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-runner \
  --query "Stacks[0].Outputs[?OutputKey=='WebhookUrl'].OutputValue" \
  --output text)

# Webhook Secret を取得
WEBHOOK_SECRET=$(aws ssm get-parameter \
  --name /${PROJECT_NAME}/${ENVIRONMENT}/GITHUB_WEBHOOK_SECRET \
  --with-decryption --query 'Parameter.Value' --output text)

# GitHub に登録
gh api repos/emc-kk/skillrelay/hooks \
  --method POST \
  -f name=web \
  -f active=true \
  -f "config[url]=${WEBHOOK_URL}" \
  -f "config[content_type]=json" \
  -f "config[secret]=${WEBHOOK_SECRET}" \
  -f "events[]=workflow_job"
```

### 確認

```bash
# 5分ほど待ってからランナー状態を確認
gh api repos/emc-kk/skillrelay/actions/runners
```
