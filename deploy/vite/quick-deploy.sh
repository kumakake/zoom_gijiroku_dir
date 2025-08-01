#!/bin/bash

# Zoom議事録システム - クイックデプロイガイド
# zm01.ast-tools.online 用

# SSH設定
SSH_KEY="~/.ssh/hit_tr01_key.pem"
SSH_HOST="ubuntu@zm01.ast-tools.online"
SSH_PORT="56890"
SSH_OPTS="-i $SSH_KEY -p $SSH_PORT -o ConnectTimeout=10 -o StrictHostKeyChecking=no"
SCP_OPTS="-P $SSH_PORT -i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no"

echo "=== Zoom議事録システム クイックデプロイ ==="
echo ""
echo "本番サーバー情報："
echo "- URL: https://zm01.ast-tools.online"
echo "- SSH: $SSH_HOST:$SSH_PORT"
echo "- 秘密鍵: $SSH_KEY"
echo ""

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
scp $SCP_OPTS ecosystem.config.js $SSH_HOST:/tmp/
scp $SCP_OPTS nginx.conf $SSH_HOST:/tmp/

# 3. リモートでデプロイ実行
echo ""
echo "3. リモートサーバーでデプロイ実行..."
ssh $SSH_OPTS $SSH_HOST << 'EOF'
    # ディレクトリ作成
#    sudo mkdir -p /opt/zm01.ast-tools.online
#    sudo chown ubuntu:ubuntu /opt/zm01.ast-tools.online
    
    # デプロイスクリプト移動
    cp /tmp/deploy.sh /opt/zm01.ast-tools.online/
    cp /tmp/ecosystem.config.js /opt/zm01.ast-tools.online/
    cp /tmp/nginx.conf /opt/zm01.ast-tools.online/
    chmod +x /opt/zm01.ast-tools.online/deploy.sh
    
    # デプロイ実行
    cd /opt/zm01.ast-tools.online
    ./deploy.sh production main
EOF

echo ""
echo "=== デプロイ完了チェック ==="
echo ""

# 4. デプロイ確認
echo "4. サービス確認..."
if curl -s -o /dev/null -w "%{http_code}" https://zm01.ast-tools.online | grep -q "200\|301\|302"; then
    echo "✅ Webサイト正常"
else
    echo "⚠️  Webサイト応答なし（SSL設定が必要な可能性）"
fi

echo ""
echo "=== 次の手順 ==="
echo "1. SSL証明書設定: sudo certbot --nginx -d zm01.ast-tools.online"
echo "2. 環境変数設定: API Keys, JWT Secrets等"
echo "3. データベース初期化（必要に応じて）"
echo "4. 動作確認: https://zm01.ast-tools.online"
echo ""
echo "詳細手順は README.md を参照してください。"
