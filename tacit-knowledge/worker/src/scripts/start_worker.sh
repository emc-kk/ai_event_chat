#!/bin/bash

# Workerサーバーを起動

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ENV環境変数を確認（外部から設定可能、デフォルトはdevelopment）
if [ -z "$ENV" ]; then
    ENV=development
fi

# ログディレクトリを作成
mkdir -p "$PROJECT_DIR/logs"

# PIDファイルのパス
PID_FILE="$PROJECT_DIR/logs/worker.pid"

# 既に起動しているかチェック
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "❌ Workerサーバーは既に起動しています (PID: $PID)"
        exit 1
    else
        echo "⚠️  古いPIDファイルを削除します"
        rm -f "$PID_FILE"
    fi
fi

cd "$PROJECT_DIR"

echo "🚀 Workerサーバーを起動しています... (ENV: $ENV)"

# バックグラウンドでWorkerサーバーを起動（-u オプションで出力バッファリングを無効化）
ENV=$ENV nohup uv run python -u worker.py \
    > "$PROJECT_DIR/logs/worker.log" 2>&1 &

# PIDを保存
echo $! > "$PID_FILE"

echo "✅ Workerサーバーが起動しました (PID: $(cat $PID_FILE))"
echo "📝 ログファイル: $PROJECT_DIR/logs/worker.log"
echo ""
echo "停止するには: ./scripts/stop_worker.sh"

