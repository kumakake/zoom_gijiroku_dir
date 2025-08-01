#!/bin/bash

# メインサーバーとワーカープロセスを並行起動するスクリプト

echo "🚀 バックエンドサービス起動中..."

# バックグラウンドでワーカープロセスを起動
echo "📋 議事録ワーカー起動中..."
node workers/transcriptWorker.js &

echo "📧 メールワーカー起動中..."
node workers/emailWorker.js &

# メインサーバーを起動（フォアグラウンド）
echo "🌐 APIサーバー起動中..."
node server.js