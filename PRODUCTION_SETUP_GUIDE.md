# 本番環境セットアップガイド - AIエージェントサービス

## 概要

AIエージェントサービス「Zoom議事録自動配布システム」の本番環境セットアップ手順書  
**URL**: `https://tools.cross-astem.jp/zm`  
**管理方式**: PM2 + Nginx + PostgreSQL + Redis

## 前提条件

### サーバー要件
- **OS**: Ubuntu 20.04 LTS以上
- **Node.js**: 18.x以上
- **PostgreSQL**: 15以上
- **Redis**: 7以上
- **Nginx**: 1.18以上
- **PM2**: 最新版

### ドメイン・SSL
- **ドメイン**: `tools.cross-astem.jp`
- **SSL証明書**: Let's Encrypt
- **サブパス運用**: `/zm`

---

## 本番環境セットアップ手順

### 1. システム依存関係インストール

```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必要パッケージインストール
sudo apt install -y curl wget git build-essential

# Node.js 18.x インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 グローバルインストール
sudo npm install -g pm2

# PostgreSQL 15 インストール
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-client-15

# Redis インストール
sudo apt-get install -y redis-server

# Nginx インストール
sudo apt-get install -y nginx

# SSL証明書取得ツール
sudo apt-get install -y certbot python3-certbot-nginx
```

### 2. データベースセットアップ

```bash
# PostgreSQL設定
sudo -u postgres psql

-- データベース・ユーザー作成
CREATE DATABASE ai_agent_prod;
CREATE USER ai_agent_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE ai_agent_prod TO ai_agent_user;
ALTER USER ai_agent_user CREATEDB;  -- マイグレーション用
\q

# 接続テスト
psql -h localhost -U ai_agent_user -d ai_agent_prod -c "SELECT version();"
```

### 3. Redis設定

```bash
# Redis設定編集
sudo vim /etc/redis/redis.conf

# 以下の設定を変更:
# bind 127.0.0.1
# requirepass your_redis_password_here
# maxmemory 512mb
# maxmemory-policy allkeys-lru

# Redis再起動
sudo systemctl restart redis
sudo systemctl enable redis

# 接続テスト
redis-cli ping
```

### 4. アプリケーションデプロイ

```bash
# 1. プロジェクトディレクトリ作成
sudo mkdir -p /var/www
cd /var/www

# 2. プロジェクトクローン
sudo git clone <your-repository-url> ai-agent-service
sudo chown -R $USER:$USER ai-agent-service
cd ai-agent-service

# 3. 依存関係インストール
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 5. 環境変数設定（ecosystem.config.js）

```bash
# ecosystem.config.js作成
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ai-agent-backend',
      script: './backend/server.js',
      cwd: '/var/www/ai-agent-service',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        
        // データベース設定
        DATABASE_URL: 'postgresql://ai_agent_user:your_secure_password_here@localhost:5432/ai_agent_prod',
        
        // Redis設定
        REDIS_URL: 'redis://:your_redis_password_here@localhost:6379',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'your_redis_password_here',
        
        // JWT設定
        JWT_SECRET: 'your_very_secure_jwt_secret_here_min_32_chars',
        JWT_REFRESH_SECRET: 'your_very_secure_refresh_secret_here_min_32_chars',
        
        // NextAuth設定
        NEXTAUTH_SECRET: 'your_very_secure_nextauth_secret_here',
        NEXTAUTH_URL: 'https://tools.cross-astem.jp/zm',
        
        // API設定
        BACKEND_API_URL: 'http://localhost:8000',
        FRONTEND_URL: 'https://tools.cross-astem.jp/zm',
        
        // CORS設定
        CORS_ORIGINS: 'https://tools.cross-astem.jp',
        
        // Zoom API設定（Server-to-Server OAuth）
        ZOOM_ACCOUNT_ID: 'your_zoom_account_id',
        ZOOM_CLIENT_ID: 'your_zoom_client_id',
        ZOOM_CLIENT_SECRET: 'your_zoom_client_secret',
        ZOOM_WEBHOOK_SECRET: 'your_zoom_webhook_secret',
        
        // AI API設定
        OPENAI_API_KEY: 'your_openai_api_key',
        ANTHROPIC_API_KEY: 'your_anthropic_api_key',
        
        // SMTP設定（本番メール配信）
        SMTP_HOST: 'your_smtp_host',
        SMTP_PORT: 587,
        SMTP_SECURE: 'false',
        SMTP_USER: 'your_smtp_user',
        SMTP_PASS: 'your_smtp_password',
        SMTP_FROM: 'noreply@cross-astem.jp',
        SMTP_FROM_NAME: 'AIエージェント 議事録システム',
        
        // 管理者設定
        ADMIN_EMAIL: 'admin@cross-astem.jp'
      }
    },
    {
      name: 'ai-agent-frontend',
      script: './frontend/start.js',
      cwd: '/var/www/ai-agent-service',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXTAUTH_SECRET: 'your_very_secure_nextauth_secret_here',
        NEXTAUTH_URL: 'https://tools.cross-astem.jp/zm',
        NEXT_PUBLIC_BACKEND_API_URL: 'https://tools.cross-astem.jp/zm/api'
      }
    }
  ]
};
EOF
```

### 6. Next.js本番設定

```bash
# next.config.js 本番設定追加
cat > frontend/next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  // サブパス設定
  basePath: '/zm',
  assetPrefix: '/zm',
  
  // 本番最適化
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: process.cwd(),
  },
  
  // 画像最適化
  images: {
    domains: ['tools.cross-astem.jp'],
    path: '/zm/_next/image',
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
EOF

# フロントエンドビルド
cd frontend
npm run build
cd ..
```

### 7. データベースマイグレーション

```bash
# マイグレーション実行
psql -h localhost -U ai_agent_user -d ai_agent_prod -f backend/migrations/001_init_schema.sql
psql -h localhost -U ai_agent_user -d ai_agent_prod -f backend/migrations/002_add_user_email_preferences.sql

# デフォルトユーザー作成（管理者）
psql -h localhost -U ai_agent_user -d ai_agent_prod -c "
INSERT INTO users (email, name, password_hash, role, is_active) 
VALUES (
  'admin@cross-astem.jp',
  '管理者',
  '\$2a\$12\$2uA4Fo/jvgdNaGJhyvJiEOnkbwtZIBWLs6XRLiRXyFS264aPaR9x6',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;
"
```

### 8. Nginx設定

```bash
# Nginx設定ファイル作成
sudo cat > /etc/nginx/sites-available/ai-agent << 'EOF'
server {
    listen 80;
    server_name tools.cross-astem.jp;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tools.cross-astem.jp;

    # SSL設定
    ssl_certificate /etc/letsencrypt/live/tools.cross-astem.jp/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tools.cross-astem.jp/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # セキュリティヘッダー
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # ログ設定
    access_log /var/log/nginx/ai-agent.access.log;
    error_log /var/log/nginx/ai-agent.error.log;

    # 基本設定
    client_max_body_size 100M;
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;

    # フロントエンド（Next.js）
    location /zm {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # バックエンドAPI
    location /zm/api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Zoom Webhook用の特別な設定
        location /zm/api/webhooks/zoom {
            proxy_pass http://localhost:8000/api/webhooks/zoom;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Webhook用ヘッダー保持
            proxy_set_header X-Zm-Request-Timestamp $http_x_zm_request_timestamp;
            proxy_set_header X-Zm-Signature $http_x_zm_signature;
        }
    }

    # 静的ファイル（Next.js）
    location /zm/_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 1y;
        add_header Cache-Control "public, immutable";
    }

    # 画像最適化（Next.js）
    location /zm/_next/image {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 1d;
    }

    # favicon等
    location ~ /zm/(favicon\.ico|robots\.txt) {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 1d;
    }
}
EOF

# サイト有効化
sudo ln -s /etc/nginx/sites-available/ai-agent /etc/nginx/sites-enabled/

# デフォルトサイト無効化（必要に応じて）
sudo rm -f /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t
```

### 9. SSL証明書取得

```bash
# Let's Encrypt証明書取得
sudo certbot --nginx -d tools.cross-astem.jp

# 自動更新設定
sudo crontab -e
# 以下を追加:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 10. PM2でアプリケーション起動

```bash
# アプリケーション起動
pm2 start ecosystem.config.js --env production

# 起動確認
pm2 status
pm2 logs

# 自動起動設定
pm2 startup
pm2 save

# モニタリング設定
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 11. Nginx起動

```bash
# Nginx起動・有効化
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl reload nginx
```

---

## 動作確認

### 1. ヘルスチェック

```bash
# 基本接続確認
curl -I https://tools.cross-astem.jp/zm

# APIヘルスチェック
curl https://tools.cross-astem.jp/zm/api/health

# フロントエンド確認
curl -I https://tools.cross-astem.jp/zm/
```

### 2. 機能テスト

1. **フロントエンドアクセス**  
   ブラウザで `https://tools.cross-astem.jp/zm` にアクセス

2. **ログイン確認**  
   管理者アカウント: `admin@cross-astem.jp` / `DemoPassword123`

3. **プロフィール設定確認**  
   ダッシュボード → プロフィール設定 → メール配信設定

4. **Zoom Webhook URL設定**  
   `https://tools.cross-astem.jp/zm/api/webhooks/zoom`

---

## セキュリティ設定

### 1. ファイアウォール設定

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### 2. セキュリティアップデート

```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. ファイル権限設定

```bash
# アプリケーションファイル権限
sudo chown -R $USER:$USER /var/www/ai-agent-service
chmod -R 755 /var/www/ai-agent-service
chmod 600 /var/www/ai-agent-service/ecosystem.config.js

# ログディレクトリ作成
sudo mkdir -p /var/log/ai-agent
sudo chown $USER:$USER /var/log/ai-agent
```

---

## 監視・メンテナンス

### 1. ログ監視

```bash
# PM2ログ
pm2 logs ai-agent-backend
pm2 logs ai-agent-frontend

# Nginxログ
sudo tail -f /var/log/nginx/ai-agent.access.log
sudo tail -f /var/log/nginx/ai-agent.error.log

# システムログ
sudo journalctl -f -u nginx
sudo journalctl -f -u postgresql
```

### 2. パフォーマンス監視

```bash
# PM2モニタリング
pm2 monit

# システムリソース
htop
iotop
```

### 3. バックアップ設定

```bash
# バックアップスクリプト作成
sudo mkdir -p /backup/ai-agent

sudo cat > /usr/local/bin/backup-ai-agent.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/ai-agent"
DATE=$(date +%Y%m%d_%H%M%S)

# データベースバックアップ
sudo -u postgres pg_dump ai_agent_prod | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 設定ファイルバックアップ
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  /var/www/ai-agent-service/ecosystem.config.js \
  /etc/nginx/sites-available/ai-agent

# 古いバックアップ削除（30日以上）
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
EOF

sudo chmod +x /usr/local/bin/backup-ai-agent.sh

# Cron設定
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-ai-agent.sh") | sudo crontab -
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. サブパス `/zm` でアクセスできない

```bash
# Next.js設定確認
grep -n "basePath\|assetPrefix" frontend/next.config.js

# 環境変数確認
pm2 show ai-agent-frontend | grep -A 20 "env:"

# Nginx設定確認
sudo nginx -t
```

#### 2. Zoom Webhook が受信できない

```bash
# Webhook署名検証確認
pm2 show ai-agent-backend | grep ZOOM_WEBHOOK_SECRET

# ログ確認
pm2 logs ai-agent-backend | grep webhook
```

#### 3. データベース接続エラー

```bash
# 接続テスト
psql -h localhost -U ai_agent_user -d ai_agent_prod -c "SELECT NOW();"

# PM2環境変数確認
pm2 show ai-agent-backend | grep DATABASE_URL
```

---

## 本番運用チェックリスト

### デプロイ前確認
- [ ] 全ての機密情報（API Keys等）が設定済み
- [ ] SSL証明書が正しく設定されている
- [ ] データベースマイグレーションが完了
- [ ] バックアップスクリプトが動作する
- [ ] ファイアウォールが適切に設定されている

### 動作確認
- [ ] Webサイトにアクセスできる（`https://tools.cross-astem.jp/zm`）
- [ ] ログイン機能が動作する
- [ ] プロフィール設定でメール配信設定を変更できる
- [ ] Zoom Webhook URLが正しく応答する
- [ ] PM2でサービスが正常に起動している

### セキュリティ確認
- [ ] 管理者アカウントのパスワード変更済み
- [ ] 全ての環境変数が本番用に設定済み
- [ ] 不要なポートが閉じられている
- [ ] ログに機密情報が出力されていない

本番環境での安全で確実な運用を実現するため、このガイドに従って慎重にデプロイを実行してください。


  主な修正点

  1. フロントエンド技術スタック更新

  - ❌ Next.js → ✅ React + Vite + TypeScript
  - ❌ Next.js App Router → ✅ React Router DOM
  - ✅ Tailwind CSS 4対応

  2. ビルド・デプロイ手順修正

  - Viteビルドコマンド: npm run build
  - 静的ファイル配置: /opt/ai-agent-service/frontend/dist
  - Nginx設定: Vite生成ファイル用に最適化

  3. 開発環境設定反映

  - Node.js 22対応
  - package.jsonの実際の構成反映
  - Docker設定との整合性確保

  4. 本番最適化

  - Vite本番ビルド設定
  - 静的アセット配信最適化
  - キャッシュ戦略（JS/CSS/画像ファイル）

  5. 現在の設定値使用

  - ecosystem.config.jsの実際の値反映
  - ポート番号（3020）確認済み
  - Redis認証情報等の実際の値

  現在の環境（Vite +
  React）に完全対応した本番環境構築手順になっています。特にNginx設定でViteビルド結果（dist/ディレクトリ）を正しく配信できるよう調整済みです。

