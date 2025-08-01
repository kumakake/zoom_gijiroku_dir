# 本番環境セットアップガイド

AIエージェントサービス - Zoom議事録自動配布システムの本番環境構築手順

---

## 📋 システム概要

### アーキテクチャ構成
- **バックエンド**: Express.js + Node.js
- **フロントエンド**: React + Vite + TypeScript
- **データベース**: PostgreSQL 15
- **キューシステム**: Redis 7 + Bull Queue
- **プロセス管理**: PM2 Cluster Mode
- **Webサーバー**: Nginx (リバースプロキシ)

### 技術スタック
```
Frontend: React 19 + Vite 5 + TypeScript + Tailwind CSS 4
Backend:  Express.js + Node.js 22
Database: PostgreSQL 15 + Redis 7
Process:  PM2 + Nginx
AI APIs:  OpenAI Whisper + Anthropic Claude
```

---

## 🚀 本番環境セットアップ手順

### 1. サーバー環境準備

#### 1.1 基本ソフトウェアインストール
```bash
# Node.js 22 LTS インストール
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 グローバルインストール
sudo npm install -g pm2

# PostgreSQL 15 インストール
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15

# Redis インストール
sudo apt install redis-server

# Nginx インストール
sudo apt install nginx

# 必要なシステムパッケージ
sudo apt install git build-essential python3 python3-pip
```

#### 1.2 ディレクトリ構造作成
```bash
# アプリケーションディレクトリ
sudo mkdir -p /opt/ai-agent-service
sudo mkdir -p /var/log/ai-agent
sudo mkdir -p /var/lib/ai-agent

# 権限設定
sudo useradd -r -d /opt/ai-agent-service -s /bin/bash aiagent
sudo chown -R aiagent:aiagent /opt/ai-agent-service
sudo chown -R aiagent:aiagent /var/log/ai-agent
sudo chown -R aiagent:aiagent /var/lib/ai-agent
```

### 2. データベースセットアップ

#### 2.1 PostgreSQL設定
```bash
# PostgreSQL管理ユーザーでログイン
sudo -u postgres psql

-- 本番用データベースとユーザー作成
CREATE DATABASE ai_agent_prod;
CREATE USER ai_agent WITH ENCRYPTED PASSWORD 'aiAgenP0ss';
GRANT ALL PRIVILEGES ON DATABASE ai_agent_prod TO ai_agent;
GRANT ALL ON SCHEMA public TO ai_agent;

-- 暗号化機能有効化
\c ai_agent_prod
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\q
```

#### 2.2 Redis設定
```bash
# Redis設定ファイル編集
sudo nano /etc/redis/redis.conf

# 以下を設定
requirepass d703a7f5419e0c207afcbb98b73b0dd23d40d555a7500296a8c29f99217fa439
bind 127.0.0.1
port 6379
maxmemory 256mb
maxmemory-policy allkeys-lru

# Redis再起動
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

### 3. アプリケーションデプロイ

#### 3.1 ソースコード配置
```bash
# aiagentユーザーに切り替え
sudo -u aiagent -s

# アプリケーションディレクトリに移動
cd /opt/ai-agent-service

# GitHubからクローン（または直接アップロード）
git clone https://github.com/your-repo/ai-agent-service.git .

# または直接ファイル転送
# scp -r ./ai-agent-service/* user@server:/opt/ai-agent-service/
```

#### 3.2 バックエンド構築
```bash
# バックエンドディレクトリ
cd /opt/ai-agent-service/backend

# 依存関係インストール
npm install --production

# マイグレーション実行
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/001_create_tenant_tables.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/002_add_tenant_columns.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/003_create_base_tables.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/004_add_job_uuid_to_transcripts.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/005_update_zoom_settings_columns.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/006_fix_webhook_secret_constraint.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/007_decrypt_client_id.sql
psql -h localhost -U ai_agent -d ai_agent_prod -f migrations/008_convert_to_bytea_encryption.sql

# ecosystem.config.js を本番環境に合わせて修正
cp ecosystem.config.js ecosystem.config.prod.js
nano ecosystem.config.prod.js
```

#### 3.3 フロントエンド構築
```bash
# フロントエンドディレクトリ
cd /opt/ai-agent-service/frontend

# 依存関係インストール
npm install

# 本番用ビルド
npm run build

# ビルド結果確認
ls -la dist/
```

### 4. Nginx設定

#### 4.1 Nginx設定ファイル作成
```bash
# Nginx設定ファイル作成
sudo nano /etc/nginx/sites-available/ai-agent-service
```

```nginx
server {
    listen 80;
    server_name zm01.ast-tools.online;

    # HTTP to HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name zm01.ast-tools.online;

    # SSL証明書設定（Let's Encryptまたは既存証明書）
    ssl_certificate /etc/ssl/certs/ai-agent-service.crt;
    ssl_certificate_key /etc/ssl/private/ai-agent-service.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 静的ファイル配信（Viteビルド結果）
    location / {
        root /opt/ai-agent-service/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # キャッシュ設定
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API リバースプロキシ
    location /api/ {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 管理者API
    location /admin/ {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Zoom Webhook
    location /api/webhooks/ {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Webhook用の長いタイムアウト
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # ログ設定
    access_log /var/log/nginx/ai-agent-access.log;
    error_log /var/log/nginx/ai-agent-error.log;

    # ファイルサイズ制限
    client_max_body_size 100M;
}
```

#### 4.2 Nginx有効化
```bash
# 設定ファイル有効化
sudo ln -s /etc/nginx/sites-available/ai-agent-service /etc/nginx/sites-enabled/

# デフォルト設定削除
sudo rm /etc/nginx/sites-enabled/default

# 設定確認
sudo nginx -t

# Nginx再起動
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 5. SSL証明書設定

#### 5.1 Let's Encrypt証明書取得
```bash
# Certbot インストール
sudo apt install certbot python3-certbot-nginx

# 証明書取得
sudo certbot --nginx -d zm01.ast-tools.online

# 自動更新設定
sudo crontab -e
# 以下を追加
0 12 * * * /usr/bin/certbot renew --quiet
```

### 6. PM2でサービス起動

#### 6.1 PM2設定確認
```bash
# ecosystem.config.js の確認・修正
cd /opt/ai-agent-service/backend
nano ecosystem.config.js

# 重要な設定項目：
# - DATABASE_URL: PostgreSQL接続情報
# - REDIS_URL: Redis接続情報  
# - ZOOM_*: Zoom API認証情報
# - ANTHROPIC_API_KEY: Claude API キー
# - CORS_ORIGIN: フロントエンドURL
```

#### 6.2 サービス起動
```bash
# PM2でアプリケーション起動
pm2 start ecosystem.config.js --env production

# 起動確認
pm2 status
pm2 logs

# PM2自動起動設定
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u aiagent --hp /opt/ai-agent-service
pm2 save
```

### 7. システムサービス設定

#### 7.1 Systemdサービス作成
```bash
# PostgreSQL自動起動
sudo systemctl enable postgresql

# Redis自動起動
sudo systemctl enable redis-server

# Nginx自動起動
sudo systemctl enable nginx

# PM2サービス確認
sudo systemctl status pm2-aiagent
```

### 8. 動作確認

#### 8.1 サービス確認
```bash
# ポート確認
sudo netstat -tlnp | grep -E ':(80|443|3020|5432|6379)'

# プロセス確認
pm2 status
ps aux | grep -E '(node|nginx|postgres|redis)'

# ログ確認
pm2 logs
tail -f /var/log/nginx/ai-agent-access.log
```

#### 8.2 機能テスト
```bash
# API ヘルスチェック
curl -k https://zm01.ast-tools.online/api/health

# フロントエンド確認
curl -k https://zm01.ast-tools.online/

# データベース接続確認
cd /opt/ai-agent-service/backend
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1', (err, res) => {
  console.log(err ? 'DB Error:' + err : 'DB OK');
  process.exit();
});
"
```

---

## 🔧 設定ファイル詳細

### ecosystem.config.js（本番環境用）
```javascript
module.exports = {
  apps: [
    {
      name: 'ai-agent-backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
        
        // データベース設定
        DATABASE_URL: 'postgresql://ai_agent:aiAgenP0ss@localhost:5432/ai_agent_prod',
        
        // Redis設定
        REDIS_URL: 'redis://default:d703a7f5419e0c207afcbb98b73b0dd23d40d555a7500296a8c29f99217fa439@localhost:6379',
        
        // JWT認証設定
        JWT_SECRET: '95c11fe88f472190092163ac8a134f34cde4da0ed8ad010ad0b4313551d51dea',
        JWT_REFRESH_SECRET: 'x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4392817465038',
        JWT_EXPIRES_IN: '24h',
        
        // Zoom API設定
        ZOOM_ACCOUNT_ID: 'AwZg1raRR_OAIeHt7n3iWw',
        ZOOM_CLIENT_ID: '_v_eaILaQCK5sTlkJbxNg',
        ZOOM_CLIENT_SECRET: 'aGJuDvCulRwNjBhB3ais3ozT17SvmIsG',
        ZOOM_WEBHOOK_SECRET: '8WRG3MujS52xw4Hd1L8xbQ',
        
        // AI API設定
        OPENAI_API_KEY: 'sk-xxx', // 実際のキーに置き換え
        ANTHROPIC_API_KEY: 'sk-ant-api03-xxx', // 実際のキーに置き換え
        
        // メール設定
        SMTP_HOST: 'localhost',
        SMTP_PORT: 25,
        SMTP_FROM: 'info@kumakake.com',
        SMTP_FROM_NAME: 'Zoom議事録システム',
        
        // セキュリティ設定
        CORS_ORIGIN: 'https://zm01.ast-tools.online',
        FRONTEND_URL: 'https://zm01.ast-tools.online',
        
        // パフォーマンス設定
        DB_POOL_MIN: 5,
        DB_POOL_MAX: 20,
        QUEUE_CONCURRENCY: 5,
        LOG_LEVEL: 'info'
      },
      
      // PM2設定
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/ai-agent/backend-error.log',
      out_file: '/var/log/ai-agent/backend-out.log',
      merge_logs: true,
      watch: false,
      kill_timeout: 5000
    }
  ]
};
```

---

## 🔒 セキュリティ設定

### 1. ファイアウォール設定
```bash
# ufw設定
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3020/tcp  # バックエンドは直接アクセス禁止
sudo ufw deny 5432/tcp  # PostgreSQL外部アクセス禁止
sudo ufw deny 6379/tcp  # Redis外部アクセス禁止
```

### 2. システムユーザー設定
```bash
# aiagentユーザーの制限
sudo usermod -s /bin/bash aiagent  # シェルアクセス有効
sudo passwd -l aiagent             # パスワードログイン無効

# sudoers設定（必要に応じて）
echo "aiagent ALL=(ALL) NOPASSWD:/usr/bin/systemctl restart pm2-aiagent" | sudo tee /etc/sudoers.d/aiagent
```

### 3. ログローテーション
```bash
# logrotate設定
sudo nano /etc/logrotate.d/ai-agent
```

```
/var/log/ai-agent/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 aiagent aiagent
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 📊 監視・メンテナンス

### 1. ヘルスチェック設定
```bash
# ヘルスチェックスクリプト作成
nano /opt/ai-agent-service/scripts/health-check.sh
```

```bash
#!/bin/bash
# AI Agent Service Health Check

# API確認
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://zm01.ast-tools.online/api/health)
if [ "$API_STATUS" != "200" ]; then
    echo "API Error: $API_STATUS"
    exit 1
fi

# データベース確認
DB_STATUS=$(cd /opt/ai-agent-service/backend && node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1', (err) => {
  process.exit(err ? 1 : 0);
});
")
if [ $? -ne 0 ]; then
    echo "Database Error"
    exit 1
fi

# Redis確認
redis-cli -a d703a7f5419e0c207afcbb98b73b0dd23d40d555a7500296a8c29f99217fa439 ping | grep PONG > /dev/null
if [ $? -ne 0 ]; then
    echo "Redis Error"
    exit 1
fi

echo "All services OK"
```

### 2. 定期メンテナンス
```bash
# crontab設定
sudo crontab -u aiagent -e
```

```cron
# ヘルスチェック（5分毎）
*/5 * * * * /opt/ai-agent-service/scripts/health-check.sh >> /var/log/ai-agent/health.log 2>&1

# PM2ログクリア（毎日）
0 2 * * * pm2 flush

# データベース VACUUM（毎週日曜）
0 3 * * 0 psql -h localhost -U ai_agent -d ai_agent_prod -c "VACUUM ANALYZE;"
```

### 3. バックアップ設定
```bash
# バックアップスクリプト作成
nano /opt/ai-agent-service/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ai-agent"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# データベースバックアップ
pg_dump -h localhost -U ai_agent -d ai_agent_prod > $BACKUP_DIR/db_backup_$DATE.sql

# 設定ファイルバックアップ  
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz \
    /opt/ai-agent-service/backend/ecosystem.config.js \
    /etc/nginx/sites-available/ai-agent-service

# 古いバックアップ削除（30日以上）
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

---

## 🚨 トラブルシューティング

### 1. よくある問題と解決方法

#### Viteビルドエラー
```bash
# Node.jsバージョン確認
node --version  # v22以上が必要

# 依存関係再インストール
cd /opt/ai-agent-service/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### PM2プロセス異常終了
```bash
# プロセス確認
pm2 status
pm2 logs --error

# 再起動
pm2 restart ai-agent-backend
pm2 reload ai-agent-backend  # 無停止再起動
```

#### データベース接続エラー
```bash
# PostgreSQL状態確認
sudo systemctl status postgresql
sudo -u postgres psql -l

# 接続テスト
psql -h localhost -U ai_agent -d ai_agent_prod -c "SELECT 1;"
```

#### Nginx 502 エラー
```bash
# バックエンド稼働確認
curl http://127.0.0.1:3020/api/health

# Nginx設定確認
sudo nginx -t
sudo systemctl reload nginx
```

### 2. ログ確認コマンド
```bash
# アプリケーションログ
pm2 logs ai-agent-backend
tail -f /var/log/ai-agent/backend-error.log

# Nginxログ
tail -f /var/log/nginx/ai-agent-access.log
tail -f /var/log/nginx/ai-agent-error.log

# システムログ
journalctl -u pm2-aiagent -f
journalctl -u nginx -f
```

---

## 📈 パフォーマンス最適化

### 1. Node.js最適化
```javascript
// ecosystem.config.js に追加
node_args: [
  '--max_old_space_size=1024',
  '--optimize-for-size'
]
```

### 2. PostgreSQL最適化
```sql
-- postgresql.conf 設定推奨値
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 100
```

### 3. Redis最適化
```bash
# redis.conf 設定推奨値
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

---

## ✅ デプロイチェックリスト

### 事前準備
- [ ] サーバースペック確認（CPU 2コア以上、RAM 4GB以上、SSD 50GB以上）
- [ ] ドメイン名とSSL証明書準備
- [ ] API キー準備（OpenAI、Anthropic、Zoom）
- [ ] SMTP設定確認

### インフラストラクチャ
- [ ] Node.js 22 LTS インストール
- [ ] PostgreSQL 15 セットアップ
- [ ] Redis 7 セットアップ
- [ ] Nginx インストール・設定
- [ ] SSL証明書設定

### アプリケーション
- [ ] ソースコード配置
- [ ] バックエンド依存関係インストール
- [ ] フロントエンドビルド実行
- [ ] データベースマイグレーション実行
- [ ] 環境変数設定（ecosystem.config.js）

### セキュリティ
- [ ] ファイアウォール設定
- [ ] SSL証明書自動更新設定
- [ ] ログローテーション設定
- [ ] システムユーザー権限設定

### 起動・確認
- [ ] PM2でバックエンド開始
- [ ] Nginx起動・確認
- [ ] ヘルスチェック実行
- [ ] フロントエンド表示確認
- [ ] API動作確認
- [ ] Zoom Webhook テスト

### 監視・メンテナンス
- [ ] ヘルスチェックスクリプト設定
- [ ] バックアップスクリプト設定
- [ ] ログ監視設定
- [ ] アラート設定

---

**更新日**: 2025年7月29日  
**対象環境**: React + Vite + Node.js + PostgreSQL + Redis  
**対象バージョン**: v1.0.0（マルチテナント対応）