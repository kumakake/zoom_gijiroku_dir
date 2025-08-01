#!/bin/bash

# =====================================================
# 環境変数セットアップスクリプト
# =====================================================
# 使用方法:
#   ./scripts/env-setup.sh dev     # 開発環境
#   ./scripts/env-setup.sh staging # ステージング環境
#   ./scripts/env-setup.sh prod    # 本番環境

set -e

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 引数チェック
if [ $# -eq 0 ]; then
    log_error "環境を指定してください: dev, staging, prod"
    echo "使用方法: $0 [dev|staging|prod]"
    exit 1
fi

ENVIRONMENT=$1
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_info "AIエージェントサービス 環境変数セットアップ"
log_info "環境: $ENVIRONMENT"
log_info "プロジェクトルート: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# ================================
# 環境別設定
# ================================
case $ENVIRONMENT in
    "dev"|"development")
        ENV_FILE=".env.development"
        COMPOSE_FILE="docker-compose.yml"
        PM2_CONFIG="deploy/ecosystem.dev.js"
        ;;
    "staging")
        ENV_FILE=".env.staging"
        COMPOSE_FILE="docker-compose.staging.yml"
        PM2_CONFIG="deploy/ecosystem.staging.js"
        ;;
    "prod"|"production")
        ENV_FILE=".env.production"
        COMPOSE_FILE="docker-compose.prod.yml"
        PM2_CONFIG="deploy/ecosystem.prod.js"
        ;;
    *)
        log_error "不正な環境名: $ENVIRONMENT"
        log_error "有効な値: dev, staging, prod"
        exit 1
        ;;
esac

# ================================
# 環境変数ファイルの作成
# ================================
log_info "環境変数ファイルの確認..."

if [ ! -f "$ENV_FILE" ]; then
    log_warning "$ENV_FILE が存在しません"
    
    if [ -f ".env.example" ]; then
        log_info ".env.example から $ENV_FILE を作成しています..."
        cp .env.example "$ENV_FILE"
        log_success "$ENV_FILE を作成しました"
        log_warning "設定値を確認・編集してください: $ENV_FILE"
    else
        log_error ".env.example が見つかりません"
        exit 1
    fi
else
    log_success "$ENV_FILE が存在します"
fi

# ================================
# PM2設定ファイルの作成
# ================================
log_info "PM2設定ファイルの確認..."

if [ ! -f "$PM2_CONFIG" ]; then
    log_warning "$PM2_CONFIG が存在しません"
    
    if [ -f "deploy/ecosystem.example.js" ]; then
        log_info "ecosystem.example.js から $PM2_CONFIG を作成しています..."
        mkdir -p "$(dirname "$PM2_CONFIG")"
        cp deploy/ecosystem.example.js "$PM2_CONFIG"
        log_success "$PM2_CONFIG を作成しました"
        log_warning "設定値を確認・編集してください: $PM2_CONFIG"
    else
        log_error "deploy/ecosystem.example.js が見つかりません"
        exit 1
    fi
else
    log_success "$PM2_CONFIG が存在します"
fi

# ================================
# 必要なディレクトリの作成
# ================================
log_info "必要なディレクトリを作成しています..."

mkdir -p logs
mkdir -p backend/temp
mkdir -p deploy

log_success "ディレクトリを作成しました"

# ================================
# 環境変数の検証
# ================================
log_info "環境変数の検証を実行しています..."

# .envファイルから必須変数をチェック
check_env_var() {
    local var_name=$1
    local env_file=$2
    
    if grep -q "^${var_name}=" "$env_file" && ! grep -q "^${var_name}=your_" "$env_file"; then
        log_success "✓ $var_name が設定されています"
        return 0
    else
        log_warning "✗ $var_name が未設定または仮の値です"
        return 1
    fi
}

# 必須環境変数のリスト
REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "NEXTAUTH_SECRET"
)

# 本番環境の場合は追加チェック
if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "production" ]; then
    REQUIRED_VARS+=(
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
        "ZOOM_API_KEY"
        "ZOOM_API_SECRET"
        "SMTP_HOST"
        "SMTP_USER"
        "SMTP_PASS"
    )
fi

missing_vars=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! check_env_var "$var" "$ENV_FILE"; then
        missing_vars=$((missing_vars + 1))
    fi
done

if [ $missing_vars -gt 0 ]; then
    log_warning "$missing_vars 個の必須環境変数が未設定です"
    log_warning "設定ファイルを確認してください: $ENV_FILE"
fi

# ================================
# セキュリティチェック
# ================================
log_info "セキュリティチェックを実行しています..."

# 弱いシークレットキーのチェック
check_secret_strength() {
    local var_name=$1
    local env_file=$2
    
    local value=$(grep "^${var_name}=" "$env_file" | cut -d'=' -f2-)
    
    if [ ${#value} -lt 32 ]; then
        log_warning "⚠ $var_name が短すぎます（32文字以上推奨）"
        return 1
    elif [[ "$value" =~ ^[a-zA-Z0-9_-]+$ ]] && [ ${#value} -ge 32 ]; then
        log_success "✓ $var_name の強度は適切です"
        return 0
    else
        log_warning "⚠ $var_name の形式を確認してください"
        return 1
    fi
}

# シークレットキーの強度チェック
SECRET_VARS=("JWT_SECRET" "NEXTAUTH_SECRET")

for var in "${SECRET_VARS[@]}"; do
    check_secret_strength "$var" "$ENV_FILE" || true
done

# ================================
# 実行可能権限の設定
# ================================
log_info "実行権限を設定しています..."

find scripts -name "*.sh" -exec chmod +x {} \;
log_success "スクリプトファイルに実行権限を設定しました"

# ================================
# 完了メッセージ
# ================================
echo ""
log_success "========================================"
log_success "環境変数セットアップが完了しました！"
log_success "========================================"
echo ""
log_info "次のステップ:"
echo ""

case $ENVIRONMENT in
    "dev"|"development")
        echo "  1. 設定を確認・編集:"
        echo "     vim $ENV_FILE"
        echo ""
        echo "  2. Docker環境を起動:"
        echo "     docker-compose up -d"
        echo ""
        echo "  3. ログを確認:"
        echo "     docker-compose logs -f"
        ;;
    "staging"|"prod"|"production")
        echo "  1. 設定を確認・編集:"
        echo "     vim $ENV_FILE"
        echo "     vim $PM2_CONFIG"
        echo ""
        echo "  2. アプリケーションをビルド:"
        echo "     npm run build"
        echo ""
        echo "  3. PM2でサービスを起動:"
        echo "     pm2 start $PM2_CONFIG --env $ENVIRONMENT"
        echo ""
        echo "  4. サービスを監視:"
        echo "     pm2 monit"
        ;;
esac

echo ""
log_info "詳細なドキュメント: books/ENVIRONMENT_SETUP.md"
echo ""

# ================================
# 環境変数ファイルの存在確認結果
# ================================
if [ $missing_vars -eq 0 ]; then
    log_success "✅ すべての必須環境変数が設定されています"
    exit 0
else
    log_warning "⚠️  一部の環境変数が未設定です"
    exit 1
fi