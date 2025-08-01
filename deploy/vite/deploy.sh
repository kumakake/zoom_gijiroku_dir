#!/bin/bash

# Zoom議事録システム - 自動デプロイスクリプト
# 使用方法: ./deploy.sh [環境] [ブランチ]
# 例: ./deploy.sh production main

set -e

# 設定
APP_NAME="zoom-minutes"
REPO_URL="https://github.com/your-repo/ai-agent-service.git"
DEPLOY_DIR="/opt/zm01.ast-tools.online/app"
BACKUP_DIR="/opt/zm01.ast-tools.online/backups"
LOG_FILE="/var/log/deploy-zoom-minutes.log"

# 引数処理
ENVIRONMENT=${1:-production}
BRANCH=${2:-main}

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ログ関数
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
    exit 1
}

# 権限チェック
check_permissions() {
    log "権限チェック中..."
    
    if [ ! -w "$DEPLOY_DIR" ]; then
        error "デプロイディレクトリに書き込み権限がありません: $DEPLOY_DIR"
    fi
    
    if ! command -v node &> /dev/null; then
        error "Node.js がインストールされていません"
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm がインストールされていません"
    fi
    
    if ! command -v pm2 &> /dev/null; then
        error "PM2 がインストールされていません"
    fi
    
    log "権限チェック完了"
}

# バックアップ作成
create_backup() {
    log "バックアップ作成中..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
    
    sudo mkdir -p $BACKUP_DIR
    
    if [ -d "$DEPLOY_DIR" ]; then
        sudo cp -r $DEPLOY_DIR $BACKUP_PATH
        log "バックアップ作成完了: $BACKUP_PATH"
    else
        warn "デプロイディレクトリが存在しません。初回デプロイ？"
    fi
}

# コードの取得/更新
update_code() {
    log "コード更新中..."
    
    if [ -d "$DEPLOY_DIR/.git" ]; then
        # 既存リポジトリの更新
        cd $DEPLOY_DIR
        git fetch origin
        git reset --hard origin/$BRANCH
        log "Git更新完了 (ブランチ: $BRANCH)"
    else
        # 新規クローン
        sudo rm -rf $DEPLOY_DIR
        sudo git clone -b $BRANCH $REPO_URL $DEPLOY_DIR
        sudo chown -R ubuntu:ubuntu $DEPLOY_DIR
        log "Git クローン完了"
    fi
}

# フロントエンドビルド
build_frontend() {
    log "フロントエンドビルド開始..."
    
    cd $DEPLOY_DIR/frontend
    
    # 依存関係インストール
    log "フロントエンド依存関係インストール中..."
    npm ci --production=false
    
    # 環境変数チェック
    if [ ! -f ".env.production" ]; then
        warn ".env.production が見つかりません。.env.example をコピーしてください"
        cp .env.example .env.production
    fi
    
    # ビルド実行
    log "Viteビルド実行中..."
    npm run build
    
    # ビルド結果確認
    if [ ! -d "dist" ]; then
        error "ビルドに失敗しました。distディレクトリが見つかりません"
    fi
    
    # 権限設定 - nginxが/optにアクセスできるように
    sudo chown -R ubuntu:ubuntu dist
    sudo chmod -R 755 dist
    # public_htmlにシンボリックリンク作成
    sudo rm -rf /opt/zm01.ast-tools.online/public_html
    sudo ln -sf /opt/zm01.ast-tools.online/app/frontend/dist /opt/zm01.ast-tools.online/public_html
    
    log "フロントエンドビルド完了"
}

# バックエンドセットアップ
setup_backend() {
    log "バックエンドセットアップ開始..."
    
    cd $DEPLOY_DIR/backend
    
    # 依存関係インストール
    log "バックエンド依存関係インストール中..."
    npm ci --only=production
    
    # 環境変数チェック
    if [ ! -f ".env.production" ]; then
        warn "バックエンド .env.production が見つかりません"
    fi
    
    log "バックエンドセットアップ完了"
}

# データベースマイグレーション
run_migrations() {
    log "データベースマイグレーション実行中..."
    
    cd $DEPLOY_DIR/backend
    
    # マイグレーションファイルチェック
    if [ -d "migrations" ]; then
        # ここでマイグレーション実行
        # npm run migrate:prod または対応するコマンド
        log "マイグレーション実行（実装が必要）"
    else
        log "マイグレーションファイルなし。スキップ"
    fi
}

# PM2プロセス管理
manage_pm2() {
    log "PM2プロセス管理中..."
    
    cd $DEPLOY_DIR
    
    # PM2プロセス停止
    if pm2 list | grep -q $APP_NAME; then
        log "既存のPM2プロセスを停止中..."
        pm2 stop $APP_NAME
        pm2 delete $APP_NAME
    fi
    
    # 新しいプロセス開始
    log "PM2プロセス開始中..."
    pm2 start deploy/vite/ecosystem.config.js --env $ENVIRONMENT
    
    # PM2設定保存
    pm2 save
    
    # プロセス状況確認
    pm2 list
    
    log "PM2プロセス管理完了"
}

# nginx設定更新
update_nginx() {
    log "nginx設定確認中..."
    
    # nginx設定ファイルの存在確認
    NGINX_CONFIG="/etc/nginx/sites-available/zoom-minutes"
    
    if [ ! -f "$NGINX_CONFIG" ]; then
        warn "nginx設定ファイルが見つかりません: $NGINX_CONFIG"
        warn "手動で設定してください"
        return
    fi
    
    # nginx設定テスト
    if sudo nginx -t; then
        log "nginx設定は正常です"
        
        # nginx再読み込み
        sudo systemctl reload nginx
        log "nginx再読み込み完了"
    else
        error "nginx設定にエラーがあります"
    fi
}

# ヘルスチェック
health_check() {
    log "ヘルスチェック実行中..."
    
    # APIヘルスチェック
    HEALTH_URL="http://localhost:8000/health"
    
    # 少し待ってからチェック
    sleep 5
    
    for i in {1..5}; do
        if curl -f -s $HEALTH_URL > /dev/null; then
            log "ヘルスチェック成功 (試行 $i/5)"
            return 0
        else
            warn "ヘルスチェック失敗 (試行 $i/5)。5秒後に再試行..."
            sleep 5
        fi
    done
    
    error "ヘルスチェックに失敗しました"
}

# クリーンアップ
cleanup() {
    log "クリーンアップ実行中..."
    
    # 古いバックアップ削除（7日以上）
    find $BACKUP_DIR -type d -name "backup_*" -mtime +7 -exec sudo rm -rf {} \; 2>/dev/null || true
    
    # PM2ログのローテーション
    pm2 flush
    
    log "クリーンアップ完了"
}

# メイン実行
main() {
    log "=== Zoom議事録システム デプロイ開始 ==="
    log "環境: $ENVIRONMENT"
    log "ブランチ: $BRANCH"
    
    check_permissions
    create_backup
    update_code
    build_frontend
    setup_backend
    run_migrations
    manage_pm2
    update_nginx
    health_check
    cleanup
    
    log "=== デプロイ完了 ==="
    log "フロントエンド: https://your-domain.com"
    log "API: http://localhost:8000"
    log "ログ: $LOG_FILE"
}

# エラーハンドリング
trap 'error "デプロイ中にエラーが発生しました。ログを確認してください: $LOG_FILE"' ERR

# 実行
main "$@"