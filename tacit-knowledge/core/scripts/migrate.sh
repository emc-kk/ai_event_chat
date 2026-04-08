#!/bin/bash

# Rails Database Migration Script for ECS
# This script runs database migrations in ECS Fargate

set -e

# Default values
CLUSTER_NAME="skillrelay-production"
REGION="ap-northeast-1"
STACK_NAME="skillrelay-infrastructure"

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -c, --cluster        ECS cluster name (default: $CLUSTER_NAME)"
    echo "  -r, --region         AWS region (default: $REGION)"
    echo "  -s, --stack-name     CloudFormation stack name (default: $STACK_NAME)"
    echo "  -h, --help           Display this help message"
    echo ""
    echo "Example:"
    echo "  $0 --cluster my-cluster --region us-west-2"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--cluster)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

echo "🗄️  Running database migrations on ECS..."
echo "Cluster: $CLUSTER_NAME"
echo "Region: $REGION"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    exit 1
fi

# Get task definition ARN from the service
echo "📋 Getting current task definition..."
TASK_DEF_ARN=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services "${CLUSTER_NAME}-service" \
    --region $REGION \
    --query 'services[0].taskDefinition' \
    --output text)

if [[ "$TASK_DEF_ARN" == "None" ]] || [[ -z "$TASK_DEF_ARN" ]]; then
    echo "Error: Could not find task definition for service"
    exit 1
fi

echo "Task Definition ARN: $TASK_DEF_ARN"

# Get subnet and security group IDs from CloudFormation outputs
echo "📡 Getting network configuration..."
SUBNET_IDS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [[ -z "$SUBNET_IDS" ]]; then
    # If not found in outputs, try to get from VPC
    VPC_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' \
        --output text)
    
    SUBNET_IDS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*public*" \
        --region $REGION \
        --query 'Subnets[0].SubnetId' \
        --output text)
fi

SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=*ecs*" \
    --region $REGION \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo "Subnet ID: $SUBNET_IDS"
echo "Security Group ID: $SECURITY_GROUP_ID"

# Run migration task
echo "🏃 Running migration task..."
TASK_ARN=$(aws ecs run-task \
    --cluster $CLUSTER_NAME \
    --task-definition $TASK_DEF_ARN \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
    --overrides '{
        "containerOverrides": [{
            "name": "rails-app",
            "command": ["./bin/rails", "db:migrate"]
        }]
    }' \
    --region $REGION \
    --query 'tasks[0].taskArn' \
    --output text)

if [[ -z "$TASK_ARN" ]]; then
    echo "❌ Failed to start migration task"
    exit 1
fi

echo "Migration task started: $TASK_ARN"

# Wait for task to complete
echo "⏳ Waiting for migration to complete..."
aws ecs wait tasks-stopped \
    --cluster $CLUSTER_NAME \
    --tasks $TASK_ARN \
    --region $REGION

# Check task exit code
EXIT_CODE=$(aws ecs describe-tasks \
    --cluster $CLUSTER_NAME \
    --tasks $TASK_ARN \
    --region $REGION \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)

if [[ "$EXIT_CODE" == "0" ]]; then
    echo "✅ Database migration completed successfully!"
else
    echo "❌ Database migration failed with exit code: $EXIT_CODE"
    
    # Get logs for debugging
    echo "📋 Migration logs:"
    aws logs get-log-events \
        --log-group-name "/ecs/${CLUSTER_NAME}" \
        --log-stream-name "ecs/rails-app/$(echo $TASK_ARN | cut -d'/' -f3)" \
        --region $REGION \
        --query 'events[*].message' \
        --output text
    
    exit 1
fi
