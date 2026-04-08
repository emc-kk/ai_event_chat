#!/bin/bash

# Workerサーバーを停止

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# PIDファイルのパス
PID_FILE="$PROJECT_DIR/logs/worker.pid"

# PIDファイルの存在をチェック
if [ ! -f "$PID_FILE" ]; then
    echo "❌ Workerサーバーは起動していません"
    exit 1
fi

PID=$(cat "$PID_FILE")

# プロセスの存在をチェック
if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "❌ Workerサーバーのプロセスが見つかりません (PID: $PID)"
    rm -f "$PID_FILE"
    exit 1
fi

echo "🛑 Workerサーバーを停止しています (PID: $PID)..."

# プロセスを停止（SIGTERMを送信してgraceful shutdownを試みる）
kill "$PID"

# プロセスが終了するまで待機（最大10秒）
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# まだ動いている場合は強制終了
if ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  強制終了します..."
    kill -9 "$PID"
    sleep 1
fi

# PIDファイルを削除
rm -f "$PID_FILE"

echo "✅ Workerサーバーを停止しました"

