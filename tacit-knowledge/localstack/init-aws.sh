#!/bin/bash
set -euo pipefail

export AWS_DEFAULT_REGION=ap-northeast-1

echo "Initializing LocalStack resources..."

# SQS Queue
awslocal sqs create-queue \
  --queue-name skillrelay-development-document-processing \
  --attributes '{"VisibilityTimeout":"300","MessageRetentionPeriod":"1209600"}'

echo "SQS Queue created:"
awslocal sqs list-queues

# S3 Bucket
awslocal s3 mb s3://skill-relay-dev

echo "S3 Bucket created:"
awslocal s3 ls

# DataSource SQS Queues
awslocal sqs create-queue \
  --queue-name skillrelay-development-datasource-dlq \
  --attributes '{"MessageRetentionPeriod":"1209600"}'

awslocal sqs create-queue \
  --queue-name skillrelay-development-datasource-tasks \
  --attributes '{"VisibilityTimeout":"300","MessageRetentionPeriod":"1209600","RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:ap-northeast-1:000000000000:skillrelay-development-datasource-dlq\",\"maxReceiveCount\":3}"}'

awslocal sqs create-queue \
  --queue-name skillrelay-development-datasource-results \
  --attributes '{"VisibilityTimeout":"60","MessageRetentionPeriod":"1209600"}'

echo "DataSource SQS Queues created:"
awslocal sqs list-queues

# DataSource S3 Bucket
awslocal s3 mb s3://skillrelay-datasource-dev

echo "DataSource S3 Bucket created"

echo "LocalStack initialization complete."
