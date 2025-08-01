# Zoom議事録システム - 本番デプロイ手順

## 本番環境情報

- **URL**: https://zm01.ast-tools.online
- **ドキュメントルート**: /opt/zm01.ast-tools.online/public_html
- **サーバー**: 116.80.61.146:56890 (ubuntu)
- **OS**: Ubuntu 24
- **Node.js**: v18.20.6
- **Webサーバー**: nginx

## データベース接続情報

- **PostgreSQL**: postgresql://ai_agent_user:aiAgenP0ss@localhost:5432/ai_agent_prod
- **Redis**: redis://:a1b2c3d4e5f6789012345678901234567890abcd@localhost:6379

## デプロイスクリプト説明

### 各スクリプトの目的と使い分け

#### 1. **deploy.sh** - サーバー上で実行する本格デプロイスクリプト

**目的：**
- サーバー上で直接実行する完全自動デプロイ
- 本番環境での定期デプロイや CI/CD パイプラインで使用

**特徴：**
- ✅ 完全なバックアップ機能
- ✅ ロールバック対応
- ✅ エラーハンドリング
- ✅ ヘルスチェック
- ✅ 段階的デプロイ（コード取得→ビルド→テスト→デプロイ）

**使用方法：**
```bash
# サーバーにSSH接続後
ssh -i ~/.ssh/hit_tr01_key.pem -p 56890 ubuntu@zm01.ast-tools.online
cd /opt/zm01.ast-tools.online
./deploy.sh production main
```

**注意点：**
- サーバー上で実行する必要がある
- 実行前に環境変数ファイル（.env.production）の準備が必要
- 初回実行時は手動でディレクトリ作成が必要

#### 2. **quick-deploy.sh** - ローカルから実行するリモートデプロイ

**目的：**
- ローカルマシンから一発でリモートデプロイ
- 初回セットアップや緊急デプロイに使用

**特徴：**
- ✅ SSH接続テスト
- ✅ ファイル自動アップロード
- ✅ リモート実行
- ❌ 詳細なエラーハンドリングなし
- ❌ バックアップ機能簡易

**使用方法：**
```bash
# ローカルマシンから実行
cd /Users/kumakake/docker/aigent/zoom/ai-agent-service
./deploy/vite/quick-deploy.sh
```

**注意点：**
- SSH秘密鍵が必要（~/.ssh/hit_tr01_key.pem）
- ネットワーク接続が安定している必要がある
- 途中でエラーが発生すると中途半端な状態になる可能性

#### 3. **manual-deploy.sh** - 段階的手動デプロイ

**目的：**
- 段階的な手動デプロイ
- デバッグや運用管理

**特徴：**
- ✅ 段階的実行（connect, upload, build, deploy, restart等）
- ✅ ログ確認機能
- ✅ SSL設定機能
- ✅ サービス監視機能

**使用方法：**
```bash
# 各段階を個別実行
./deploy/vite/manual-deploy.sh connect    # サーバー接続
./deploy/vite/manual-deploy.sh build      # ビルドのみ
./deploy/vite/manual-deploy.sh status     # 状況確認
./deploy/vite/manual-deploy.sh logs       # ログ確認
```

**注意点：**
- 各段階の実行順序に注意
- 運用時のメンテナンスに最適

### 推奨使用パターン

| 状況         | 推奨スクリプト   | 理由                 |
|--------------|------------------|----------------------|
| 初回デプロイ | manual-deploy.sh | 段階的確認が可能     |
| 定期デプロイ | deploy.sh        | 安全性とバックアップ |
| 緊急デプロイ | quick-deploy.sh  | 迅速な対応           |
| 運用・監視   | manual-deploy.sh | 柔軟な管理機能       |
|--------------|------------------|----------------------|

## デプロイ手順

### 1. サーバー接続・ソースコードの配置

```bash
# サーバーに接続
ssh -i ~/.ssh/hit_tr01_key.pem -p 56890 ubuntu@zm01.ast-tools.online

# アプリケーションディレクトリに移動
cd /opt/zm01.ast-tools.online

# ソースコードをクローン（初回のみ）
sudo git clone https://github.com/your-repo/ai-agent-service.git app
sudo chown -R ubuntu:ubuntu app
cd app
```

### 2. フロントエンドビルド

```bash
# フロントエンドディレクトリに移動
cd frontend

# 依存関係インストール
npm install

# 本番用環境変数設定（後述）
cp .env.example .env.production

# 本番ビルド
npm run build
```

### 3. 環境変数設定

`frontend/.env.production` を作成：

```env
# API Base URL（本番バックエンドURL）
VITE_API_BASE_URL=https://zm01.ast-tools.online/api

# アプリケーション設定
VITE_APP_NAME=Zoom議事録システム
VITE_APP_VERSION=1.0.0

# 本番環境フラグ
NODE_ENV=production
```

`backend/.env.production` を作成：

```env
NODE_ENV=production
PORT=8000

# データベース接続
DATABASE_URL=postgresql://ai_agent_user:aiAgenP0ss@localhost:5432/ai_agent_prod
REDIS_URL=redis://:a1b2c3d4e5f6789012345678901234567890abcd@localhost:6379

# JWT設定
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-here

# AI API設定
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Zoom API設定
ZOOM_API_KEY=your-zoom-api-key
ZOOM_API_SECRET=your-zoom-api-secret
ZOOM_WEBHOOK_SECRET=your-zoom-webhook-secret

# メール設定
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Zoom議事録システム

# CORS設定
FRONTEND_URL=https://zm01.ast-tools.online

# ログ設定
LOG_LEVEL=info
```

### 4. nginx設定

`/etc/nginx/sites-available/zoom-minutes` を作成：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL設定
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # フロントエンド（Viteビルド済み）
    location / {
        root /var/www/ai-agent-service/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # キャッシュ設定
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # バックエンドAPI
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### 5. nginx有効化

```bash
# 設定ファイルをリンク
sudo ln -s /etc/nginx/sites-available/zoom-minutes /etc/nginx/sites-enabled/

# 設定テスト
sudo nginx -t

# nginx再起動
sudo systemctl restart nginx
```

### 6. バックエンドデプロイ（PM2）

```bash
# バックエンドディレクトリに移動
cd ../backend

# 依存関係インストール
npm install

# PM2設定ファイル使用
pm2 start ../deploy/vite/ecosystem.config.js

# PM2保存
pm2 save
pm2 startup
```

### 7. SSL証明書設定（Let's Encrypt）

```bash
# Certbot インストール
sudo apt update
sudo apt install certbot python3-certbot-nginx

# SSL証明書取得
sudo certbot --nginx -d your-domain.com

# 自動更新設定
sudo crontab -e
# 以下を追加
0 12 * * * /usr/bin/certbot renew --quiet
```

## 継続的デプロイ

### 自動デプロイスクリプト

`deploy.sh` を使用（後述）：

```bash
# デプロイ実行
chmod +x deploy/vite/deploy.sh
./deploy/vite/deploy.sh
```

### GitHub Actions（オプション）

`.github/workflows/deploy.yml` でCI/CD設定可能。

## 共通の注意点とベストプラクティス

### デプロイ前の確認事項

1. **環境変数の準備**
   ```bash
   # 必須: API Keys設定
   # - JWT_SECRET, JWT_REFRESH_SECRET
   # - OPENAI_API_KEY, ANTHROPIC_API_KEY  
   # - ZOOM_API_KEY, ZOOM_API_SECRET, ZOOM_WEBHOOK_SECRET
   # - SMTP設定
   ```

2. **SSH接続の確認**
   ```bash
   # 秘密鍵のパーミッション確認
   chmod 600 ~/.ssh/hit_tr01_key.pem
   
   # 接続テスト
   ssh -i ~/.ssh/hit_tr01_key.pem -p 56890 ubuntu@zm01.ast-tools.online
   ```

3. **データベース接続の確認**
   ```bash
   # PostgreSQL接続テスト
   psql postgresql://ai_agent_user:aiAgenP0ss@localhost:5432/ai_agent_prod
   
   # Redis接続テスト
   redis-cli -u redis://:a1b2c3d4e5f6789012345678901234567890abcd@localhost:6379
   ```

### セキュリティ重要事項

⚠️ **機密情報の管理**
- 環境変数ファイルは `.gitignore` に追加
- パスワードやAPIキーは環境変数で管理
- SSH秘密鍵は適切なパーミッション設定

⚠️ **バックアップの重要性**
- 本番デプロイ前は必ずバックアップ実行
- データベースの定期バックアップ設定
- ロールバック手順の確認

### デプロイ失敗時の対処

1. **ログの確認**
   ```bash
   # アプリケーションログ
   ./deploy/vite/manual-deploy.sh logs
   
   # システムログ
   sudo journalctl -f -u nginx
   ```

2. **サービスの状態確認**
   ```bash
   # サービス状況
   ./deploy/vite/manual-deploy.sh status
   
   # プロセス確認
   pm2 list
   sudo systemctl status nginx
   ```

3. **緊急時のロールバック**
   ```bash
   # バックアップからの復旧（deploy.shの場合）
   sudo cp -r /opt/zm01.ast-tools.online/backups/backup_YYYYMMDD_HHMMSS/* /opt/zm01.ast-tools.online/app/
   ./deploy/vite/manual-deploy.sh restart
   ```

## トラブルシューティング

### よくある問題

1. **ビルドエラー**
   ```bash
   # ノードモジュール再インストール
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **ルーティングエラー**
   - nginx設定で `try_files $uri $uri/ /index.html;` が正しいか確認

3. **API接続エラー**
   - `VITE_API_BASE_URL` の設定確認
   - CORSエラーの場合はバックエンド設定確認

4. **権限エラー**
   ```bash
   # ファイル権限修正
   sudo chown -R www-data:www-data /var/www/ai-agent-service/frontend/dist
   ```

### ログ確認

```bash
# nginx ログ
sudo tail -f /var/log/nginx/error.log

# PM2 ログ
pm2 logs

# システムログ
sudo journalctl -f
```

## パフォーマンス最適化

### 1. Build最適化
```bash
# ビルドサイズ分析
npm run build -- --analyze
```

### 2. CDN使用（オプション）
- 静的ファイルをCDN配信
- 画像最適化

### 3. キャッシュ戦略
- nginx レベルでのキャッシュ設定済み
- ブラウザキャッシュ活用

## セキュリティ

### 1. nginx セキュリティヘッダー
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

### 2. ファイアウォール設定
```bash
# UFW設定
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## バックアップ

### 自動バックアップ設定
```bash
# 日次バックアップ cron
0 2 * * * /var/www/ai-agent-service/deploy/vite/backup.sh
```

## 監視

### ヘルスチェック
- `/api/health` エンドポイント監視
- nginx ステータス監視
- PM2 プロセス監視

### メトリクス
- アクセスログ分析
- エラー率監視
- レスポンス時間監視
