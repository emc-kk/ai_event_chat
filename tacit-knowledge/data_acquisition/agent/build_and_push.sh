#!/bin/bash
# =============================================================================
# Docker イメージのビルドと ECR プッシュ
# =============================================================================
#
# Usage:
#   cd data_acquisition && bash agent/build_and_push.sh
#   bash agent/build_and_push.sh --tag v1.0.0
#
# 前提:
#   - Docker が起動していること
#   - AWS CLI が設定済みであること (ECR へのプッシュ権限)
#
# =============================================================================

set -euo pipefail

AWS_ACCOUNT_ID="778389812638"
AWS_REGION="ap-northeast-1"
ECR_REPO="skillrelay-scraper-agent"
IMAGE_TAG="${1:---tag}"

# Parse arguments
TAG="latest"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag) TAG="$2"; shift 2 ;;
        *) shift ;;
    esac
done

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_CONTEXT="$(dirname "$SCRIPT_DIR")"  # data_acquisition/

echo "=== SkillRelay Scraper Agent Docker Build ==="
echo "  ECR:      ${ECR_URI}"
echo "  Tag:      ${TAG}"
echo "  Context:  ${BUILD_CONTEXT}"
echo ""

# 1. ECR ログイン
echo "[1/3] ECR login..."
aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# 2. ビルド (linux/amd64 — EC2ターゲット用)
echo ""
echo "[2/3] Building image..."
docker build \
    --platform linux/amd64 \
    -t "${ECR_URI}:${TAG}" \
    -t "${ECR_URI}:latest" \
    -f "${SCRIPT_DIR}/Dockerfile" \
    "$BUILD_CONTEXT"

# 3. プッシュ
echo ""
echo "[3/3] Pushing to ECR..."
docker push "${ECR_URI}:${TAG}"
if [ "$TAG" != "latest" ]; then
    docker push "${ECR_URI}:latest"
fi

echo ""
echo "=== Done ==="
echo "  Image: ${ECR_URI}:${TAG}"
echo "  Pull:  docker pull ${ECR_URI}:${TAG}"
