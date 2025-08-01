#!/bin/bash

# Zoom議事録システム - クイックデプロイガイド
# zm01.ast-tools.online 用

# SSH設定
SSH_KEY="~/.ssh/hit_tr01_key.pem"
SSH_HOST="ubuntu@zm01.ast-tools.online"
SSH_PORT="56890"
SSH_OPTS="-p $SSH_PORT -i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no"
SCP_OPTS="-P $SSH_PORT -i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no"

echo "=== Zoom議事録システム クイックデプロイ ==="
echo ""
echo "本番サーバー情報："
echo "- URL: https://zm01.ast-tools.online"
echo "- SSH: $SSH_HOST:$SSH_PORT"
echo "- 秘密鍵: $SSH_KEY"
echo ""

echo $SSH_OPTS

# 1. サーバー接続確認
echo "1. サーバー接続テスト..."
if ssh $SSH_OPTS $SSH_HOST "echo 'Connection OK'"; then
    echo "✅ サーバー接続成功"
else
    echo "❌ サーバー接続失敗"
    echo "SSH設定を確認してください"
    exit 1
fi

# 2. デプロイスクリプトのアップロード
echo ""
echo "2. デプロイスクリプトをサーバーにアップロード..."
scp $SCP_OPTS deploy.sh $SSH_HOST:/tmp/
