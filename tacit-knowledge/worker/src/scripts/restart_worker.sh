#!/bin/bash

# Workerサーバーを再起動

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Workerサーバーを再起動します..."
echo ""

# 停止
"$SCRIPT_DIR/stop_worker.sh" 2>/dev/null

# 少し待機
sleep 2

# 起動
"$SCRIPT_DIR/start_worker.sh"

