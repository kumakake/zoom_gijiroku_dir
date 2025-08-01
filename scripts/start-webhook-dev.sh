#!/bin/bash

# Zoom Webhook開発用スクリプト
# ngrokでローカルサーバーを外部公開

echo "🚀 Zoom Webhook開発環境を開始します..."

# バックエンドサーバーの起動確認
echo "📡 バックエンドサーバーの確認中..."
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "❌ バックエンドサーバーが起動していません"
    echo "以下のコマンドでサーバーを起動してください:"
    echo "docker compose up -d backend"
    exit 1
fi

echo "✅ バックエンドサーバーが正常に動作しています"

# ngrokのインストール確認
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrokがインストールされていません"
    echo "以下のコマンドでインストールしてください:"
    echo "brew install ngrok"
    exit 1
fi

# ngrok認証確認
if ! ngrok config check &> /dev/null; then
    echo "⚠️  ngrokの認証が設定されていません"
    echo "以下の手順で設定してください:"
    echo "1. https://dashboard.ngrok.com/signup でアカウント作成"
    echo "2. 認証トークンを取得"
    echo "3. ngrok config add-authtoken YOUR_AUTHTOKEN"
    echo ""
    echo "設定後、このスクリプトを再実行してください"
    exit 1
fi

echo "🌐 ngrokトンネルを開始します..."
echo ""
echo "================================================"
echo "📋 Zoom Webhook設定情報"
echo "================================================"
echo ""

# ngrok開始（設定ファイル使用 - HTTPS限定）
# プロジェクトルートのngrok.ymlの設定を使用してHTTPS限定トンネルを開始
cd "$(dirname "$0")/.." # プロジェクトルートに移動
ngrok start ai-agent-backend --config ./ngrok.yml --log=stdout &

# ngrokの起動を待機（最大30秒）
echo "ngrokの起動を待機中..."
for i in {1..30}; do
    sleep 1
    if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
        echo "ngrok Web UIが利用可能になりました"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ ngrok Web UIの起動がタイムアウトしました"
        exit 1
    fi
done

# 追加の待機でトンネル情報を確実に取得
sleep 2

# ngrok APIから公開URLを取得（JSONパースを改善）
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for tunnel in data.get('tunnels', []):
        if tunnel.get('name') == 'ai-agent-backend':
            print(tunnel.get('public_url', ''))
            break
except:
    pass
")

# フォールバック: python3が無い場合はgrepを使用
if [ -z "$NGROK_URL" ]; then
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -oE 'https://[a-zA-Z0-9-]+\.ngrok-free\.app' | head -1)
fi

if [ -n "$NGROK_URL" ]; then
    echo "✅ ngrokトンネルが正常に開始されました"
    echo ""
    echo "🔗 Public URL: $NGROK_URL"
    echo "🎯 Webhook URL: $NGROK_URL/api/webhooks/zoom"
    echo ""
    echo "================================================"
    echo "📝 Zoom App設定手順"
    echo "================================================"
    echo "1. Zoom Marketplace にアクセス"
    echo "   https://marketplace.zoom.us/develop/create"
    echo ""
    echo "2. Webhook設定でこのURLを登録:"
    echo "   $NGROK_URL/api/webhooks/zoom"
    echo ""
    echo "3. 有効にするイベント:"
    echo "   ✓ recording.completed"
    echo "   ✓ meeting.ended"
    echo ""
    echo "4. Webhook Secret を .env.development に設定:"
    echo "   ZOOM_WEBHOOK_SECRET=your_webhook_secret"
    echo ""
    echo "================================================"
    echo "🔧 開発用ダッシュボード"
    echo "================================================"
    echo "ngrok管理画面: http://localhost:4040"
    echo "アプリ管理画面: http://localhost:3000/dashboard"
    echo ""
    echo "Ctrl+C で終了します"
    echo ""
else
    echo "❌ ngrokトンネルの開始に失敗しました"
    exit 1
fi

# プロセス待機（Ctrl+Cで終了）
echo "ngrokが起動中です。Ctrl+Cで終了してください。"
wait
