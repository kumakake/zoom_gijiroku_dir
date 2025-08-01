#!/bin/bash

# フロントエンド開発用: 変更が反映されない場合の強制リセットスクリプト
# 使用方法: ./scripts/dev-frontend-reset.sh

echo "🔄 フロントエンド強制リセット開始..."

# 1. フロントエンドコンテナ停止・削除
echo "📦 フロントエンドコンテナを停止・削除中..."
docker compose stop frontend
docker compose rm -f frontend

# 2. イメージ削除（キャッシュクリア）
echo "🗑️ フロントエンドイメージを削除中..."
docker rmi ai-agent-service-dir-frontend 2>/dev/null || echo "イメージは既に削除済み"

# 3. 完全リビルド
echo "🔨 フロントエンドを完全リビルド中..."
docker compose build frontend --no-cache

# 4. 再起動
echo "🚀 フロントエンドを再起動中..."
docker compose up -d frontend

# 5. ログ確認
echo "📋 フロントエンドログを表示中..."
docker compose logs frontend --tail=20

echo "✅ フロントエンド強制リセット完了!"
echo ""
echo "🌐 ブラウザで以下を実行してください:"
echo "  1. 開発者ツール（F12）を開く"
echo "  2. Network タブで 'Disable cache' にチェック"
echo "  3. 強制リロード（Ctrl+F5 / Cmd+Shift+R）"
echo ""
echo "🔍 変更確認コマンド:"
echo "  docker compose exec frontend grep '変更内容' /app/src/ファイル名"