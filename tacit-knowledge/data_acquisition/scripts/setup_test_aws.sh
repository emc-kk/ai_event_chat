#!/bin/bash
# Data Acquisition テスト環境セットアップスクリプト
# SQS 3キュー + S3バケット + IAMロール + Spot Launch Template を構築
set -euo pipefail

REGION="ap-northeast-1"
PREFIX="skillrelay-test"
VPC_ID="vpc-065346a81bda19025"
SUBNET_ID="subnet-0d128f182eebf2e43"  # public-subnet-1 (ap-northeast-1a)
ACCOUNT_ID="778389812638"

echo "=== Data Acquisition Test Environment Setup ==="

# 1. SQS Queues
echo "[1/6] Creating SQS queues..."

DLQ_URL=$(aws sqs create-queue \
  --queue-name "${PREFIX}-data-acquisition-dlq" \
  --attributes '{"MessageRetentionPeriod":"1209600"}' \
  --region "$REGION" \
  --query 'QueueUrl' --output text 2>&1)
echo "  DLQ: $DLQ_URL"

DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --region "$REGION" \
  --query 'Attributes.QueueArn' --output text)

TASK_QUEUE_URL=$(aws sqs create-queue \
  --queue-name "${PREFIX}-data-acquisition-tasks" \
  --attributes "{\"VisibilityTimeout\":\"300\",\"MessageRetentionPeriod\":\"1209600\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":3}\"}" \
  --region "$REGION" \
  --query 'QueueUrl' --output text 2>&1)
echo "  Task Queue: $TASK_QUEUE_URL"

RESULT_QUEUE_URL=$(aws sqs create-queue \
  --queue-name "${PREFIX}-data-acquisition-results" \
  --attributes '{"VisibilityTimeout":"60","MessageRetentionPeriod":"1209600"}' \
  --region "$REGION" \
  --query 'QueueUrl' --output text 2>&1)
echo "  Result Queue: $RESULT_QUEUE_URL"

# 2. S3 Bucket
echo "[2/6] Creating S3 bucket..."
aws s3 mb "s3://${PREFIX}-data-acquisition" --region "$REGION" 2>/dev/null || echo "  Bucket already exists"

# 3. IAM Role for Spot Worker
echo "[3/6] Creating IAM role..."

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}'

aws iam create-role \
  --role-name "${PREFIX}-data-acquisition-spot-role" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --region "$REGION" 2>/dev/null || echo "  Role already exists"

# Inline policy
POLICY_DOC="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"sqs:ReceiveMessage\",\"sqs:DeleteMessage\",\"sqs:GetQueueAttributes\",\"sqs:GetQueueUrl\"],
      \"Resource\": \"arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${PREFIX}-data-acquisition-tasks\"
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"sqs:SendMessage\"],
      \"Resource\": \"arn:aws:sqs:${REGION}:${ACCOUNT_ID}:${PREFIX}-data-acquisition-results\"
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:GetObject\",\"s3:PutObject\",\"s3:ListBucket\"],
      \"Resource\": [\"arn:aws:s3:::${PREFIX}-data-acquisition/*\",\"arn:aws:s3:::${PREFIX}-data-acquisition\"]
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"ssm:GetParameter\",\"ssm:GetParameters\"],
      \"Resource\": \"arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/skillrelay/*\"
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],
      \"Resource\": \"*\"
    }
  ]
}"

aws iam put-role-policy \
  --role-name "${PREFIX}-data-acquisition-spot-role" \
  --policy-name "DataAcquisitionSpotPolicy" \
  --policy-document "$POLICY_DOC" \
  --region "$REGION"

# 4. Instance Profile
echo "[4/6] Creating instance profile..."
aws iam create-instance-profile \
  --instance-profile-name "${PREFIX}-data-acquisition-spot-profile" \
  --region "$REGION" 2>/dev/null || echo "  Profile already exists"

aws iam add-role-to-instance-profile \
  --instance-profile-name "${PREFIX}-data-acquisition-spot-profile" \
  --role-name "${PREFIX}-data-acquisition-spot-role" \
  --region "$REGION" 2>/dev/null || echo "  Role already attached"

echo "  Waiting for instance profile propagation..."
sleep 10

# 5. Security Group
echo "[5/6] Creating security group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name "${PREFIX}-data-acquisition-spot-sg" \
  --description "Data Acquisition Spot Worker SG" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --query 'GroupId' --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PREFIX}-data-acquisition-spot-sg" \
    --region "$REGION" \
    --query 'SecurityGroups[0].GroupId' --output text)
echo "  SG: $SG_ID"

# SSH用 (テスト時のみ)
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 22 \
  --cidr "0.0.0.0/0" \
  --region "$REGION" 2>/dev/null || true

# 6. Upload boot script to S3
echo "[6/6] Uploading boot script to S3..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_ACQUISITION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DATA_ACQUISITION_DIR"

tar czf /tmp/worker_boot.tar.gz worker/ scripts/spot_interrupt_handler.sh
aws s3 cp /tmp/worker_boot.tar.gz "s3://${PREFIX}-data-acquisition/scripts/worker_boot.tar.gz" --region "$REGION"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Queue URLs:"
echo "  TASK:   $TASK_QUEUE_URL"
echo "  RESULT: $RESULT_QUEUE_URL"
echo "  DLQ:    $DLQ_URL"
echo ""
echo "S3 Bucket: ${PREFIX}-data-acquisition"
echo "IAM Role:  ${PREFIX}-data-acquisition-spot-role"
echo "SG:        $SG_ID"
echo ""
echo "To launch a Spot instance:"
echo "  aws ec2 run-instances \\"
echo "    --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \\"
echo "    --instance-type c5.large \\"
echo "    --instance-market-options '{\"MarketType\":\"spot\",\"SpotOptions\":{\"SpotInstanceType\":\"one-time\",\"MaxPrice\":\"0.05\"}}' \\"
echo "    --iam-instance-profile Name=${PREFIX}-data-acquisition-spot-profile \\"
echo "    --security-group-ids $SG_ID \\"
echo "    --subnet-id $SUBNET_ID \\"
echo "    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=${PREFIX}-data-acquisition-spot}]' \\"
echo "    --user-data file:///tmp/data_acquisition_user_data.sh \\"
echo "    --region $REGION"
