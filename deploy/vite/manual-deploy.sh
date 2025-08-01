#!/bin/bash

# Zoom議事録システム - 手動デプロイスクリプト
# zm01.ast-tools.online 用（秘密鍵認証）

# SSH設定
SSH_KEY="~/.ssh/hit_tr01_key.pem"
SSH_HOST="ubuntu@zm01.ast-tools.online"
SSH_PORT="56890"
SSH_OPTS="-i $SSH_KEY -p $SSH_PORT"

echo "=== Zoom議事録システム 手動デプロイ ==="
echo ""

# 引数チェック
if [ $# -eq 0 ]; then
    echo "使用方法: $0 <コマンド>"
    echo ""
    echo "利用可能なコマンド:"
    echo "  connect     - サーバーに接続"
    echo "  upload      - ファイルをアップロード"
    echo "  build       - フロントエンドビルド"
    echo "  deploy      - 完全デプロイ"
    echo "  restart     - サービス再起動"
    echo "  logs        - ログ確認"
    echo "  status      - サービス状況確認"
    echo "  ssl         - SSL証明書設定"
    echo ""
    exit 1
fi

COMMAND=$1

case $COMMAND in
    "connect")
        echo "サーバーに接続しています..."
        ssh $SSH_OPTS $SSH_HOST
        ;;
    
    "upload")
        echo "デプロイファイルをアップロード中..."
        scp $SSH_OPTS deploy.sh $SSH_HOST:/tmp/
        scp $SSH_OPTS ecosystem.config.js $SSH_HOST:/tmp/
        scp $SSH_OPTS nginx.conf $SSH_HOST:/tmp/
        echo "✅ アップロード完了"
        ;;
    
    "build")
        echo "フロントエンドビルド実行中..."
        ssh $SSH_OPTS $SSH_HOST << 'EOF'
            cd /opt/zm01.ast-tools.online/app/frontend
            npm install
            npm run build
            
            # public_htmlへのシンボリックリンク更新
            sudo rm -rf /opt/zm01.ast-tools.online/public_html
            sudo ln -sf /opt/zm01.ast-tools.online/app/frontend/dist /opt/zm01.ast-tools.online/public_html
            
            echo "✅ ビルド完了"
EOF
        ;;
    
    "deploy")
        echo "完全デプロイ実行中..."
        
        # 1. ファイルアップロード
        echo "1. ファイルアップロード..."
        scp $SSH_OPTS deploy.sh $SSH_HOST:/tmp/
        scp $SSH_OPTS ecosystem.config.js $SSH_HOST:/tmp/
        scp $SSH_OPTS nginx.conf $SSH_HOST:/tmp/
        
        # 2. リモートデプロイ実行
        echo "2. リモートデプロイ実行..."
        ssh $SSH_OPTS $SSH_HOST << 'EOF'
            # ディレクトリ準備
            sudo mkdir -p /opt/zm01.ast-tools.online
            sudo chown ubuntu:ubuntu /opt/zm01.ast-tools.online
            
            # ファイル移動
            cp /tmp/deploy.sh /opt/zm01.ast-tools.online/
            cp /tmp/ecosystem.config.js /opt/zm01.ast-tools.online/
            cp /tmp/nginx.conf /opt/zm01.ast-tools.online/
            chmod +x /opt/zm01.ast-tools.online/deploy.sh
            
            # デプロイ実行
            cd /opt/zm01.ast-tools.online
            ./deploy.sh production main
EOF
        ;;
    
    "restart")
        echo "サービス再起動中..."
        ssh $SSH_OPTS $SSH_HOST << 'EOF'
            # PM2再起動
            pm2 restart zoom-minutes-api || pm2 start /opt/zm01.ast-tools.online/ecosystem.config.js
            
            # nginx再起動
            sudo systemctl restart nginx
            
            echo "✅ サービス再起動完了"
EOF
        ;;
    
    "logs")
        echo "ログ確認中..."
        ssh $SSH_OPTS $SSH_HOST << 'EOF'
            echo "=== PM2 ログ ==="
            pm2 logs zoom-minutes-api --lines 50
            
            echo ""
            echo "=== nginx エラーログ ==="
            sudo tail -n 20 /var/log/nginx/error.log
            
            echo ""
            echo "=== デプロイログ ==="
            tail -n 20 /var/log/deploy-zoom-minutes.log 2>/dev/null || echo "デプロイログなし"
EOF
        ;;
    
    "status")
        echo "サービス状況確認中..."
        ssh $SSH_OPTS $SSH_HOST << 'EOF'
            echo "=== PM2 状況 ==="
            pm2 list
            
            echo ""
            echo "=== nginx 状況 ==="
            sudo systemctl status nginx --no-pager
            
            echo ""
            echo "=== ディスク使用量 ==="
            df -h /opt/zm01.ast-tools.online
            
            echo ""
            echo "=== メモリ使用量 ==="
            free -h
            
            echo ""
            echo "=== ネットワーク確認 ==="
            ss -tlnp | grep -E ':80|:443|:8000'
EOF
        ;;
    
    "ssl")
        echo "SSL証明書設定中..."
        ssh $SSH_OPTS $SSH_HOST << 'EOF'
            # Let's Encrypt インストール確認
            if ! command -v certbot &> /dev/null; then
                echo "Certbot インストール中..."
                sudo apt update
                sudo apt install -y certbot python3-certbot-nginx
            fi
            
            # SSL証明書取得
            echo "SSL証明書取得中..."
            sudo certbot --nginx -d zm01.ast-tools.online --non-interactive --agree-tos --email admin@zm01.ast-tools.online
            
            # 自動更新設定
            echo "自動更新設定中..."
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
            
            echo "✅ SSL設定完了"
EOF
        ;;
    
    *)
        echo "❌ 不明なコマンド: $COMMAND"
        echo "使用方法: $0 <コマンド>"
        exit 1
        ;;
esac

echo ""
echo "=== 完了 ==="
echo "URL: https://zm01.ast-tools.online"