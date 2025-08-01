#!/bin/bash

# ========================================================
# AIエージェントサービス デプロイスクリプト
# 対象サーバー: zm01.ast-tools.online
# ========================================================

set -e  # エラー時に停止

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ出力関数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 設定値
DOMAIN="zm01.ast-tools.online"
APP_DIR="/opt/zm01.ast-tools.online"
REPO_URL="https://github.com/yourusername/ai-agent-service.git"  # 実際のリポジトリURLに変更
NGINX_CONF_SOURCE="deploy/nginx/nginx.conf"
NGINX_CONF_TARGET="/etc/nginx/sites-available/$DOMAIN"
NODE_VERSION="18"

# 引数チェック
COMMAND=${1:-help}

# ヘルプ表示
show_help() {
    cat << EOF
AIエージェントサービス デプロイスクリプト

使用方法:
    $0 [コマンド]

コマンド:
    setup       - 初回セットアップ（システム準備）
    ssl         - SSL証明書取得
    deploy      - アプリケーションデプロイ
    restart     - サービス再起動
    status      - サービス状態確認
    logs        - ログ表示
    backup      - バックアップ作成
    rollback    - 前回バックアップから復旧
    help        - このヘルプを表示

例:
    $0 setup     # 初回セットアップ
    $0 deploy    # デプロイ実行
    $0 status    # 状態確認
EOF
}

# root権限チェック
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "このスクリプトはrootユーザーで実行しないでください"
        exit 1
    fi
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # Ubuntu確認
    if ! grep -q "Ubuntu" /etc/os-release; then
        log_error "このスクリプトはUbuntu用です"
        exit 1
    fi
    
    # インターネット接続確認
    if ! ping -c 1 google.com &> /dev/null; then
        log_error "インターネット接続がありません"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# システムセットアップ
setup_system() {
    log_info "システムセットアップを開始..."
    
    # パッケージ更新
    log_info "パッケージを更新中..."
    sudo apt update && sudo apt upgrade -y
    
    # 必要パッケージインストール
    log_info "必要パッケージをインストール中..."
    sudo apt install -y \
        nginx \
        postgresql-14 \
        redis-server \
        postfix \
        mailutils \
        certbot \
        python3-certbot-nginx \
        curl \
        git \
        ufw \
        htop \
        unzip
    
    # Node.js セットアップ
    setup_nodejs
    
    # PostgreSQL セットアップ
    setup_postgresql
    
    # Redis セットアップ
    setup_redis
    
    # ファイアウォール設定
    setup_firewall
    
    # アプリケーションディレクトリ作成
    log_info "アプリケーションディレクトリを作成中..."
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    
    # ログディレクトリ作成
    log_info "ログディレクトリを作成中..."
    sudo mkdir -p /var/log/ai-agent
    sudo chown $USER:$USER /var/log/ai-agent
    sudo chmod 755 /var/log/ai-agent
    
    log_success "システムセットアップ完了"
}

# Node.js セットアップ
setup_nodejs() {
    log_info "Node.js をセットアップ中..."
    
    # NodeSourceリポジトリ追加
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    
    # Node.js インストール
    sudo apt install -y nodejs
    
    # バージョン確認
    node_version=$(node --version)
    npm_version=$(npm --version)
    log_success "Node.js $node_version, npm $npm_version インストール完了"
    
    # PM2 グローバルインストール
    sudo npm install -g pm2
    pm2_version=$(pm2 --version)
    log_success "PM2 $pm2_version インストール完了"
}

# PostgreSQL セットアップ
setup_postgresql() {
    log_info "PostgreSQL をセットアップ中..."
    
    # PostgreSQL起動・有効化
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # データベース・ユーザー作成
    sudo -u postgres psql << EOF
CREATE DATABASE ai_agent_prod;
CREATE USER ai_agent WITH PASSWORD 'secure_password_$(openssl rand -hex 8)';
GRANT ALL PRIVILEGES ON DATABASE ai_agent_prod TO ai_agent;
ALTER USER ai_agent CREATEDB;
\q
EOF
    
    log_success "PostgreSQL セットアップ完了"
}

# Redis セットアップ
setup_redis() {
    log_info "Redis をセットアップ中..."
    
    # Redis設定
    sudo sed -i 's/# requirepass foobared/requirepass '$(openssl rand -hex 32)'/' /etc/redis/redis.conf
    
    # Redis起動・有効化
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    
    log_success "Redis セットアップ完了"
}

# ファイアウォール設定
setup_firewall() {
    log_info "ファイアウォールを設定中..."
    
    # UFW有効化
    sudo ufw --force enable
    
    # 基本ルール
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # 必要ポート開放
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    
    log_success "ファイアウォール設定完了"
}

# SSL証明書取得
setup_ssl() {
    log_info "SSL証明書を取得中..."
    
    # Let's Encrypt証明書取得
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # 自動更新設定確認
    sudo certbot renew --dry-run
    
    log_success "SSL証明書取得完了"
}

# アプリケーションデプロイ
deploy_app() {
    log_info "アプリケーションをデプロイ中..."
    
    # ログディレクトリ確認・作成
    if [ ! -d "/var/log/ai-agent" ]; then
        log_info "ログディレクトリを作成中..."
        sudo mkdir -p /var/log/ai-agent
        sudo chown $USER:$USER /var/log/ai-agent
        sudo chmod 755 /var/log/ai-agent
    fi
    
    # バックアップ作成
    if [ -d "$APP_DIR" ] && [ "$(ls -A $APP_DIR)" ]; then
        create_backup
    fi
    
    # リポジトリクローン or 更新
    if [ -d "$APP_DIR/.git" ]; then
        log_info "既存リポジトリを更新中（スキップ）..."
        cd $APP_DIR
        # git fetch origin
        # git reset --hard origin/main
    else
        log_info "リポジトリをクローン中..."
        git clone $REPO_URL $APP_DIR
        cd $APP_DIR
    fi
    
    # バックエンド依存関係インストール
    log_info "バックエンド依存関係をインストール中..."
    cd $APP_DIR/backend
    npm ci --production
    
    # フロントエンドビルド
    log_info "フロントエンドをビルド中..."
    cd $APP_DIR/frontend
    npm ci
    npm run build
    
    # データベースマイグレーション
    run_migrations
    
    # Nginx設定適用
    deploy_nginx_config
    
    # PM2設定適用
    deploy_pm2_config
    
    log_success "アプリケーションデプロイ完了"
}

# データベースマイグレーション
run_migrations() {
    log_info "データベースマイグレーションを実行中..."
    
    cd $APP_DIR/backend
    
    # マイグレーションファイル実行
    for migration in migrations/*.sql; do
        if [ -f "$migration" ]; then
            log_info "実行中: $migration"
            sudo -u postgres psql -d ai_agent_prod -f "$migration"
        fi
    done
    
    log_success "データベースマイグレーション完了"
}

# Nginx設定デプロイ
deploy_nginx_config() {
    log_info "Nginx設定を適用中..."
    
    # 設定ファイルコピー
    sudo cp $APP_DIR/$NGINX_CONF_SOURCE $NGINX_CONF_TARGET
    
    # サイト有効化
    sudo ln -sf $NGINX_CONF_TARGET /etc/nginx/sites-enabled/$DOMAIN
    
    # デフォルトサイト無効化
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 設定テスト
    sudo nginx -t
    
    # Nginx再起動
    sudo systemctl restart nginx
    
    log_success "Nginx設定適用完了"
}

# PM2設定デプロイ
deploy_pm2_config() {
    log_info "PM2設定を適用中..."
    
    cd $APP_DIR
    
    # 既存プロセス停止
    pm2 delete all 2>/dev/null || true
    
    # 新しい設定で起動
    pm2 start deploy/nginx/ecosystem.production.js
    
    # PM2設定保存
    pm2 save
    
    # 自動起動設定
    pm2 startup | grep 'sudo' | bash
    
    log_success "PM2設定適用完了"
}

# サービス再起動
restart_services() {
    log_info "サービスを再起動中..."
    
    # PM2プロセス再起動
    pm2 restart all
    
    # Nginx再起動
    sudo systemctl restart nginx
    
    # PostgreSQL再起動
    sudo systemctl restart postgresql
    
    # Redis再起動
    sudo systemctl restart redis-server
    
    log_success "サービス再起動完了"
}

# サービス状態確認
check_status() {
    log_info "サービス状態を確認中..."
    
    # システムサービス
    echo "=== システムサービス ==="
    sudo systemctl status nginx --no-pager -l
    sudo systemctl status postgresql --no-pager -l
    sudo systemctl status redis-server --no-pager -l
    
    # PM2プロセス
    echo "=== PM2プロセス ==="
    pm2 status
    
    # ポート確認
    echo "=== ポート使用状況 ==="
    sudo netstat -tlnp | grep -E ':80|:443|:3020|:3021|:5432|:6379'
    
    # ディスク使用量
    echo "=== ディスク使用量 ==="
    df -h
    
    # メモリ使用量
    echo "=== メモリ使用量 ==="
    free -h
    
    # SSL証明書確認
    echo "=== SSL証明書 ==="
    sudo certbot certificates
}

# ログ表示
show_logs() {
    log_info "ログを表示中..."
    
    case ${2:-all} in
        nginx)
            sudo tail -f /var/log/nginx/zm01.access.log
            ;;
        app)
            pm2 logs
            ;;
        db)
            sudo tail -f /var/log/postgresql/postgresql-14-main.log
            ;;
        mail)
            sudo tail -f /var/log/mail.log
            ;;
        *)
            echo "利用可能なログ:"
            echo "  nginx - Nginxアクセスログ"
            echo "  app   - アプリケーションログ"
            echo "  db    - PostgreSQLログ"
            echo "  mail  - メールログ"
            echo ""
            echo "使用例: $0 logs nginx"
            ;;
    esac
}

# バックアップ作成
create_backup() {
    log_info "バックアップを作成中..."
    
    BACKUP_DIR="/backup/$(date +%Y%m%d_%H%M%S)"
    sudo mkdir -p $BACKUP_DIR
    
    # アプリケーションファイル
    sudo tar czf $BACKUP_DIR/app.tar.gz -C $APP_DIR .
    
    # データベース
    sudo -u postgres pg_dump ai_agent_prod | sudo tee $BACKUP_DIR/database.sql > /dev/null
    
    # Nginx設定
    sudo cp $NGINX_CONF_TARGET $BACKUP_DIR/nginx.conf
    
    # PM2設定
    pm2 save
    sudo cp ~/.pm2/dump.pm2 $BACKUP_DIR/pm2.json
    
    sudo chown -R $USER:$USER $BACKUP_DIR
    
    log_success "バックアップ作成完了: $BACKUP_DIR"
}

# ロールバック
rollback() {
    log_info "ロールバックを実行中..."
    
    # 最新バックアップ検索
    LATEST_BACKUP=$(ls -1t /backup/ | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "バックアップが見つかりません"
        exit 1
    fi
    
    BACKUP_PATH="/backup/$LATEST_BACKUP"
    log_info "バックアップから復旧中: $BACKUP_PATH"
    
    # アプリケーション復旧
    rm -rf $APP_DIR/*
    tar xzf $BACKUP_PATH/app.tar.gz -C $APP_DIR
    
    # データベース復旧
    sudo -u postgres dropdb ai_agent_prod
    sudo -u postgres createdb ai_agent_prod
    sudo -u postgres psql ai_agent_prod -f $BACKUP_PATH/database.sql
    
    # Nginx設定復旧
    sudo cp $BACKUP_PATH/nginx.conf $NGINX_CONF_TARGET
    sudo nginx -t && sudo systemctl restart nginx
    
    # PM2設定復旧
    pm2 delete all
    cp $BACKUP_PATH/pm2.json ~/.pm2/dump.pm2
    pm2 resurrect
    
    log_success "ロールバック完了"
}

# ヘルスチェック
health_check() {
    log_info "ヘルスチェックを実行中..."
    
    # HTTP確認
    if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health | grep -q "200"; then
        log_success "HTTP ヘルスチェック: OK"
    else
        log_error "HTTP ヘルスチェック: NG"
    fi
    
    # データベース確認
    if sudo -u postgres psql -d ai_agent_prod -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "データベース: OK"
    else
        log_error "データベース: NG"
    fi
    
    # Redis確認
    if redis-cli ping > /dev/null 2>&1; then
        log_success "Redis: OK"
    else
        log_error "Redis: NG"
    fi
}

# メイン処理
main() {
    case $COMMAND in
        setup)
            check_root
            check_prerequisites
            setup_system
            ;;
        ssl)
            setup_ssl
            ;;
        deploy)
            check_prerequisites
            deploy_app
            health_check
            ;;
        restart)
            restart_services
            health_check
            ;;
        status)
            check_status
            ;;
        logs)
            show_logs "$@"
            ;;
        backup)
            create_backup
            ;;
        rollback)
            rollback
            ;;
        health)
            health_check
            ;;
        help)
            show_help
            ;;
        *)
            log_error "不明なコマンド: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"