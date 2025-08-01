# 環境変数設定ガイド - zm01.ast-tools.online

## 概要

AIエージェントサービスの本番環境で使用する環境変数の設定手順とセキュリティガイドラインです。

## 1. 環境変数一覧

### 基本設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| NODE_ENV | 実行環境 | production | ✅ |
| PORT | アプリケーションポート | 3020, 3021 | ✅ |
| NEXTAUTH_URL | NextAuth用URL | https://zm01.ast-tools.online | ✅ |

### データベース設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| DATABASE_URL | PostgreSQL接続URL | postgresql://user:pass@localhost:5432/db | ✅ |
| DB_POOL_MIN | 最小接続数 | 5 | - |
| DB_POOL_MAX | 最大接続数 | 20 | - |

### Redis設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| REDIS_URL | Redis接続URL | redis://:password@localhost:6379 | ✅ |
| REDIS_PASSWORD | Redisパスワード | secure_password | ✅ |

### 認証設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| JWT_SECRET | JWT署名用秘密鍵 | 32文字以上のランダム文字列 | ✅ |
| NEXTAUTH_SECRET | NextAuth秘密鍵 | 32文字以上のランダム文字列 | ✅ |
| JWT_EXPIRES_IN | JWTトークン有効期限 | 24h | - |
| JWT_REFRESH_EXPIRES_IN | リフレッシュトークン有効期限 | 7d | - |

### AI API設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| OPENAI_API_KEY | OpenAI APIキー | sk-... | ✅ |
| ANTHROPIC_API_KEY | Anthropic APIキー | sk-ant-... | ✅ |

### Zoom API設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| ZOOM_ACCOUNT_ID | ZoomアカウントID | Account ID | ✅ |
| ZOOM_CLIENT_ID | ZoomクライアントID | Client ID | ✅ |
| ZOOM_CLIENT_SECRET | Zoomクライアントシークレット | Client Secret | ✅ |
| ZOOM_WEBHOOK_SECRET | Zoom Webhookシークレット | Webhook Secret | ✅ |
| ZOOM_WEBHOOK_URL | Webhook URL | https://zm01.ast-tools.online/api/webhooks/zoom | ✅ |

### SMTP設定

| 変数名 | 説明 | 例 | 必須 |
|--------|------|----|----|
| SMTP_HOST | SMTPホスト | localhost | ✅ |
| SMTP_PORT | SMTPポート | 25 | ✅ |
| SMTP_SECURE | SSL使用 | false | ✅ |
| SMTP_USER | SMTPユーザー | (空文字) | - |
| SMTP_PASS | SMTPパスワード | (空文字) | - |
| SMTP_FROM | 送信者アドレス | noreply@zm01.ast-tools.online | ✅ |
| SMTP_FROM_NAME | 送信者名 | ZM01 AI Agent Service | ✅ |

## 2. セキュア環境変数生成

### パスワード・秘密鍵生成

```bash
# 32文字のランダム文字列生成（JWT/NextAuth用）
openssl rand -hex 32

# 64文字のランダム文字列生成（より強固）
openssl rand -hex 64

# Base64エンコードされた秘密鍵生成
openssl rand -base64 48

# UUIDv4生成
uuidgen

# PostgreSQLパスワード生成（英数字記号混合）
openssl rand -base64 24 | tr '+/' '-_'
```

### 実際の設定例

```bash
# セキュア値の生成
JWT_SECRET=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr '+/' '-_')
REDIS_PASSWORD=$(openssl rand -hex 32)

echo "JWT_SECRET=$JWT_SECRET"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "DB_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
```

## 3. 環境変数ファイル作成

### 本番環境用ファイル

```bash
# /opt/zm01.ast-tools.online/.env.production
cat << 'EOF' > /opt/zm01.ast-tools.online/.env.production
# ========================================================
# AIエージェントサービス 本番環境設定
# zm01.ast-tools.online
# ========================================================

# 基本設定
NODE_ENV=production
NEXTAUTH_URL=https://zm01.ast-tools.online

# データベース設定
DATABASE_URL=postgresql://ai_agent:REPLACE_WITH_ACTUAL_PASSWORD@localhost:5432/ai_agent_prod
DB_POOL_MIN=5
DB_POOL_MAX=20

# Redis設定
REDIS_URL=redis://:REPLACE_WITH_ACTUAL_PASSWORD@localhost:6379
REDIS_PASSWORD=REPLACE_WITH_ACTUAL_PASSWORD

# 認証設定
JWT_SECRET=REPLACE_WITH_ACTUAL_SECRET
NEXTAUTH_SECRET=REPLACE_WITH_ACTUAL_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# AI API設定
OPENAI_API_KEY=REPLACE_WITH_ACTUAL_KEY
ANTHROPIC_API_KEY=REPLACE_WITH_ACTUAL_KEY

# Zoom API設定
ZOOM_ACCOUNT_ID=REPLACE_WITH_ACTUAL_ID
ZOOM_CLIENT_ID=REPLACE_WITH_ACTUAL_ID
ZOOM_CLIENT_SECRET=REPLACE_WITH_ACTUAL_SECRET
ZOOM_WEBHOOK_SECRET=REPLACE_WITH_ACTUAL_SECRET
ZOOM_WEBHOOK_URL=https://zm01.ast-tools.online/api/webhooks/zoom

# SMTP設定（Postfix）
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@zm01.ast-tools.online
SMTP_FROM_NAME=ZM01 AI Agent Service

# セキュリティ設定
CORS_ORIGIN=https://zm01.ast-tools.online
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# パフォーマンス設定
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=5000
REQUEST_TIMEOUT=300000
BODY_LIMIT=50mb

# ファイル設定
UPLOAD_DIR=/opt/zm01.ast-tools.online/uploads
MAX_FILE_SIZE=104857600

# ログ設定
LOG_LEVEL=info
LOG_FILE=/var/log/ai-agent/app.log

# 監視設定
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true

# VTT処理設定
VTT_PRIORITY=true
WHISPER_FALLBACK=true

# メール配信設定
EMAIL_BATCH_SIZE=10
EMAIL_DELAY=1000
EOF

# ファイル権限設定（重要）
chmod 600 /opt/zm01.ast-tools.online/.env.production
chown ubuntu:ubuntu /opt/zm01.ast-tools.online/.env.production
```

## 4. 環境変数置換スクリプト

### 自動置換スクリプト

```bash
#!/bin/bash
# /opt/zm01.ast-tools.online/scripts/setup-env.sh

set -e

log_info() { echo "[INFO] $1"; }
log_error() { echo "[ERROR] $1"; exit 1; }

ENV_FILE="/opt/zm01.ast-tools.online/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    log_error "環境変数ファイルが見つかりません: $ENV_FILE"
fi

log_info "セキュア環境変数を生成中..."

# セキュア値生成
JWT_SECRET=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr '+/' '-_')
REDIS_PASSWORD=$(openssl rand -hex 32)

log_info "データベースパスワードを更新中..."
# PostgreSQLユーザーパスワード更新
sudo -u postgres psql << EOF
ALTER USER ai_agent WITH PASSWORD '$DB_PASSWORD';
\q
EOF

log_info "Redisパスワードを更新中..."
# Redis設定更新
sudo sed -i "s/^# requirepass .*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
sudo sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
sudo systemctl restart redis-server

log_info "環境変数ファイルを更新中..."
# 環境変数置換
sed -i "s/REPLACE_WITH_ACTUAL_PASSWORD/$DB_PASSWORD/g" "$ENV_FILE"
sed -i "s/REPLACE_WITH_ACTUAL_SECRET/$JWT_SECRET/g" "$ENV_FILE"
sed -i "0,/REPLACE_WITH_ACTUAL_SECRET/s//$NEXTAUTH_SECRET/" "$ENV_FILE"
sed -i "s/REDIS_PASSWORD=REPLACE_WITH_ACTUAL_PASSWORD/REDIS_PASSWORD=$REDIS_PASSWORD/g" "$ENV_FILE"
sed -i "s/:REPLACE_WITH_ACTUAL_PASSWORD@/:$REDIS_PASSWORD@/g" "$ENV_FILE"

log_info "手動設定が必要な環境変数:"
echo "  - OPENAI_API_KEY"
echo "  - ANTHROPIC_API_KEY"
echo "  - ZOOM_ACCOUNT_ID"
echo "  - ZOOM_CLIENT_ID"
echo "  - ZOOM_CLIENT_SECRET"
echo "  - ZOOM_WEBHOOK_SECRET"
echo ""
echo "設定ファイル: $ENV_FILE"

log_info "環境変数セットアップ完了"
```

```bash
# スクリプト実行権限付与
chmod +x /opt/zm01.ast-tools.online/scripts/setup-env.sh

# 実行
sudo /opt/zm01.ast-tools.online/scripts/setup-env.sh
```

## 5. 手動設定が必要な環境変数

### API キー設定

```bash
# 環境変数ファイル編集
sudo nano /opt/zm01.ast-tools.online/.env.production

# 以下の値を実際のAPIキーに置換:
# OPENAI_API_KEY=sk-your-actual-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key
# ZOOM_ACCOUNT_ID=your-actual-zoom-account-id
# ZOOM_CLIENT_ID=your-actual-zoom-client-id
# ZOOM_CLIENT_SECRET=your-actual-zoom-client-secret
# ZOOM_WEBHOOK_SECRET=your-actual-zoom-webhook-secret
```

## 6. 環境変数検証

### 検証スクリプト

```bash
#!/bin/bash
# /opt/zm01.ast-tools.online/scripts/validate-env.sh

ENV_FILE="/opt/zm01.ast-tools.online/.env.production"

log_info() { echo -e "\e[32m[OK]\e[0m $1"; }
log_error() { echo -e "\e[31m[ERROR]\e[0m $1"; }
log_warning() { echo -e "\e[33m[WARNING]\e[0m $1"; }

# 環境変数読み込み
source "$ENV_FILE"

echo "=== 環境変数検証 ==="

# 必須環境変数チェック
REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "NEXTAUTH_SECRET"
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
    "ZOOM_ACCOUNT_ID"
    "ZOOM_CLIENT_ID"
    "ZOOM_CLIENT_SECRET"
    "ZOOM_WEBHOOK_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] || [[ "${!var}" == *"REPLACE_WITH_ACTUAL"* ]]; then
        log_error "$var が設定されていないか、プレースホルダーのままです"
    else
        log_info "$var が設定されています"
    fi
done

# 秘密鍵の長さチェック
if [ ${#JWT_SECRET} -lt 32 ]; then
    log_warning "JWT_SECRETは32文字以上を推奨します (現在: ${#JWT_SECRET}文字)"
else
    log_info "JWT_SECRETの長さは適切です (${#JWT_SECRET}文字)"
fi

if [ ${#NEXTAUTH_SECRET} -lt 32 ]; then
    log_warning "NEXTAUTH_SECRETは32文字以上を推奨します (現在: ${#NEXTAUTH_SECRET}文字)"
else
    log_info "NEXTAUTH_SECRETの長さは適切です (${#NEXTAUTH_SECRET}文字)"
fi

# データベース接続テスト
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log_info "データベース接続: 正常"
else
    log_error "データベース接続: 失敗"
fi

# Redis接続テスト
if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
    log_info "Redis接続: 正常"
else
    log_error "Redis接続: 失敗"
fi

echo "=== 検証完了 ==="
```

```bash
# 実行権限付与と実行
chmod +x /opt/zm01.ast-tools.online/scripts/validate-env.sh
/opt/zm01.ast-tools.online/scripts/validate-env.sh
```

## 7. セキュリティベストプラクティス

### ファイル権限

```bash
# 環境変数ファイルの権限を適切に設定
chmod 600 /opt/zm01.ast-tools.online/.env.production
chown ubuntu:ubuntu /opt/zm01.ast-tools.online/.env.production

# ディレクトリ権限
chmod 750 /opt/zm01.ast-tools.online
chown ubuntu:ubuntu /opt/zm01.ast-tools.online
```

### バックアップ・復旧

```bash
# 環境変数バックアップ
sudo cp /opt/zm01.ast-tools.online/.env.production /backup/env-$(date +%Y%m%d).backup

# 暗号化バックアップ
sudo gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --symmetric \
    --output /backup/env-$(date +%Y%m%d).gpg \
    /opt/zm01.ast-tools.online/.env.production
```

### 定期的なキーローテーション

```bash
# 月次実行スクリプト
#!/bin/bash
# /opt/zm01.ast-tools.online/scripts/rotate-keys.sh

NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_NEXTAUTH_SECRET=$(openssl rand -hex 32)

# バックアップ作成
cp /opt/zm01.ast-tools.online/.env.production /backup/env-before-rotation-$(date +%Y%m%d).backup

# キー更新（注意: このスクリプトは慎重に使用）
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" /opt/zm01.ast-tools.online/.env.production
sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$NEW_NEXTAUTH_SECRET/" /opt/zm01.ast-tools.online/.env.production

# PM2再起動
pm2 restart all

echo "キーローテーション完了: $(date)"
```

## 8. 環境変数注入方法

### PM2での使用

```bash
# ecosystem.production.jsで環境変数読み込み
pm2 start ecosystem.production.js --env production

# または環境変数ファイル指定
pm2 start ecosystem.production.js --env production --env-file /opt/zm01.ast-tools.online/.env.production
```

### systemdサービスでの使用

```bash
# systemdサービスファイル例
cat << 'EOF' > /etc/systemd/system/ai-agent.service
[Unit]
Description=AI Agent Service
After=network.target

[Service]
Type=forking
User=ubuntu
WorkingDirectory=/opt/zm01.ast-tools.online
EnvironmentFile=/opt/zm01.ast-tools.online/.env.production
ExecStart=/usr/local/bin/pm2 start ecosystem.production.js
ExecReload=/usr/local/bin/pm2 restart all
ExecStop=/usr/local/bin/pm2 stop all
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# サービス有効化
sudo systemctl enable ai-agent.service
sudo systemctl start ai-agent.service
```

## 9. トラブルシューティング

### よくある問題

#### 1. 環境変数が読み込まれない

```bash
# PM2プロセスの環境変数確認
pm2 env [プロセス名]

# 環境変数ファイル構文確認
bash -n /opt/zm01.ast-tools.online/.env.production
```

#### 2. データベース接続エラー

```bash
# 接続テスト
psql "$DATABASE_URL" -c "SELECT version();"

# パスワード確認
sudo -u postgres psql -c "SELECT rolname FROM pg_roles WHERE rolname = 'ai_agent';"
```

#### 3. Redis接続エラー

```bash
# Redis接続テスト
redis-cli -u "$REDIS_URL" ping

# Redis設定確認
sudo grep "^requirepass" /etc/redis/redis.conf
```

## 10. 完了確認チェックリスト

- [ ] 環境変数ファイル作成完了
- [ ] セキュア値生成・設定完了
- [ ] API キー設定完了
- [ ] データベース接続確認完了
- [ ] Redis接続確認完了
- [ ] ファイル権限設定完了
- [ ] バックアップ設定完了
- [ ] 検証スクリプト実行完了
- [ ] PM2起動確認完了

## 参考資料

- [Node.js環境変数ベストプラクティス](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)
- [PM2環境変数設定](https://pm2.keymetrics.io/docs/usage/environment/)
- [セキュア設定ガイドライン](https://owasp.org/www-project-cheat-sheets/cheatsheets/Configuration_Cheat_Sheet.html)