#!/bin/bash

# Zoom議事録システム - 自動バックアップスクリプト
# Cron設定例: 0 2 * * * /var/www/ai-agent-service/deploy/vite/backup.sh

set -e

# 設定
APP_NAME="zoom-minutes"
BACKUP_ROOT="/var/backups/zoom-minutes"
SOURCE_DIR="/var/www/ai-agent-service"
RETENTION_DAYS=30
LOG_FILE="/var/log/backup-zoom-minutes.log"

# データベース設定
DB_NAME="ai_agent_prod"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# 日付
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$DATE"

# ログ関数
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a $LOG_FILE
    exit 1
}

# バックアップディレクトリ作成
create_backup_dir() {
    log "バックアップディレクトリ作成: $BACKUP_DIR"
    mkdir -p $BACKUP_DIR
}

# アプリケーションコードバックアップ
backup_application() {
    log "アプリケーションコードバックアップ開始"
    
    # ソースコード
    tar -czf "$BACKUP_DIR/application-$DATE.tar.gz" \
        -C $(dirname $SOURCE_DIR) \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='*.log' \
        --exclude='dist' \
        --exclude='build' \
        $(basename $SOURCE_DIR)
    
    log "アプリケーションコードバックアップ完了"
}

# データベースバックアップ
backup_database() {
    log "データベースバックアップ開始"
    
    # PostgreSQL
    PGPASSWORD=$DB_PASSWORD pg_dump \
        -h $DB_HOST \
        -p $DB_PORT \
        -U $DB_USER \
        -d $DB_NAME \
        --no-password \
        --clean \
        --if-exists \
        --create \
        > "$BACKUP_DIR/database-$DATE.sql"
    
    # 圧縮
    gzip "$BACKUP_DIR/database-$DATE.sql"
    
    log "データベースバックアップ完了"
}

# Redisバックアップ
backup_redis() {
    log "Redisバックアップ開始"
    
    # Redis RDB ファイルコピー
    if [ -f "/var/lib/redis/dump.rdb" ]; then
        cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis-$DATE.rdb"
        gzip "$BACKUP_DIR/redis-$DATE.rdb"
        log "Redisバックアップ完了"
    else
        log "Redis RDBファイルが見つかりません"
    fi
}

# nginx設定バックアップ
backup_nginx() {
    log "nginx設定バックアップ開始"
    
    tar -czf "$BACKUP_DIR/nginx-config-$DATE.tar.gz" \
        /etc/nginx/sites-available/$APP_NAME \
        /etc/nginx/nginx.conf \
        2>/dev/null || true
    
    log "nginx設定バックアップ完了"
}

# PM2設定バックアップ
backup_pm2() {
    log "PM2設定バックアップ開始"
    
    # PM2プロセスリスト
    pm2 jlist > "$BACKUP_DIR/pm2-processes-$DATE.json" 2>/dev/null || true
    
    # PM2設定
    if [ -f "$SOURCE_DIR/deploy/vite/ecosystem.config.js" ]; then
        cp "$SOURCE_DIR/deploy/vite/ecosystem.config.js" "$BACKUP_DIR/ecosystem-config-$DATE.js"
    fi
    
    log "PM2設定バックアップ完了"
}

# SSL証明書バックアップ
backup_ssl() {
    log "SSL証明書バックアップ開始"
    
    if [ -d "/etc/letsencrypt/live" ]; then
        tar -czf "$BACKUP_DIR/ssl-certificates-$DATE.tar.gz" \
            /etc/letsencrypt/live \
            /etc/letsencrypt/renewal \
            2>/dev/null || true
    fi
    
    log "SSL証明書バックアップ完了"
}

# ログファイルバックアップ
backup_logs() {
    log "ログファイルバックアップ開始"
    
    # アプリケーションログ
    if [ -d "/var/log/pm2" ]; then
        tar -czf "$BACKUP_DIR/app-logs-$DATE.tar.gz" \
            /var/log/pm2/$APP_NAME* \
            2>/dev/null || true
    fi
    
    # nginxログ（最新の1週間分）
    find /var/log/nginx -name "*zoom-minutes*" -mtime -7 -type f | \
    tar -czf "$BACKUP_DIR/nginx-logs-$DATE.tar.gz" \
        -T - 2>/dev/null || true
    
    log "ログファイルバックアップ完了"
}

# 古いバックアップ削除
cleanup_old_backups() {
    log "古いバックアップ削除開始（${RETENTION_DAYS}日以上）"
    
    find $BACKUP_ROOT -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    
    log "古いバックアップ削除完了"
}

# バックアップサイズ計算
calculate_size() {
    if [ -d "$BACKUP_DIR" ]; then
        SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
        log "バックアップサイズ: $SIZE"
    fi
}

# 整合性チェック
verify_backup() {
    log "バックアップ整合性チェック開始"
    
    # ファイル存在確認
    local files_ok=true
    
    for file in "application-$DATE.tar.gz" "database-$DATE.sql.gz"; do
        if [ ! -f "$BACKUP_DIR/$file" ]; then
            error "必須バックアップファイルが見つかりません: $file"
            files_ok=false
        fi
    done
    
    if [ "$files_ok" = true ]; then
        log "バックアップ整合性チェック完了"
    fi
}

# メール通知（オプション）
send_notification() {
    local status=$1
    local message=$2
    
    # MailHog や実際のSMTPが設定されている場合
    # echo "$message" | mail -s "Zoom議事録システム バックアップ $status" admin@your-domain.com
    
    log "通知: $status - $message"
}

# メイン実行
main() {
    log "=== Zoom議事録システム バックアップ開始 ==="
    
    create_backup_dir
    
    # 各種バックアップ実行
    backup_application
    backup_database
    backup_redis
    backup_nginx
    backup_pm2
    backup_ssl
    backup_logs
    
    # 後処理
    verify_backup
    calculate_size
    cleanup_old_backups
    
    log "=== バックアップ完了 ==="
    send_notification "成功" "バックアップが正常に完了しました: $BACKUP_DIR"
}

# エラーハンドリング
trap 'send_notification "失敗" "バックアップ中にエラーが発生しました。ログを確認してください: $LOG_FILE"' ERR

# 実行
main "$@"