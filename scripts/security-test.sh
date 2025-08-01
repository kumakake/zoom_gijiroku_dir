#!/bin/bash

# ============================================================
# セキュリティヘッダー テストスクリプト
# ============================================================
# 使用方法:
#   ./scripts/security-test.sh                    # ローカル環境テスト
#   ./scripts/security-test.sh production         # 本番環境テスト

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
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# 環境設定
ENVIRONMENT=${1:-"development"}

if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://tools.cross-astem.jp/zm"
    API_URL="https://tools.cross-astem.jp/zm/api"
else
    BASE_URL="http://localhost:3000"
    API_URL="http://localhost:8000/api"
fi

log_info "セキュリティテストを開始します"
log_info "対象環境: $ENVIRONMENT"
log_info "API URL: $API_URL"

# ============================================================
# セキュリティヘッダーのテスト
# ============================================================

test_security_headers() {
    log_info "セキュリティヘッダーのテストを実行中..."
    
    # ヘルスチェックエンドポイントでヘッダーを確認
    local response=$(curl -s -I "${API_URL%/api}/health" 2>/dev/null || echo "")
    
    if [ -z "$response" ]; then
        log_error "サーバーに接続できませんでした"
        return 1
    fi
    
    # 必須セキュリティヘッダーのチェック
    local headers_to_check=(
        "X-Content-Type-Options: nosniff"
        "X-Frame-Options: DENY"
        "X-XSS-Protection: 1; mode=block"
        "Referrer-Policy:"
        "Content-Security-Policy:"
    )
    
    for header in "${headers_to_check[@]}"; do
        if echo "$response" | grep -qi "$header"; then
            log_success "✓ $header が設定されています"
        else
            log_warning "✗ $header が見つかりません"
        fi
    done
    
    # HSTSヘッダー（本番環境のみ）
    if [ "$ENVIRONMENT" = "production" ]; then
        if echo "$response" | grep -qi "Strict-Transport-Security:"; then
            log_success "✓ HSTS が設定されています"
        else
            log_warning "✗ HSTS ヘッダーが見つかりません"
        fi
    fi
    
    # Server情報の隠蔽チェック
    if echo "$response" | grep -qi "Server:"; then
        log_warning "✗ Server情報が露出しています"
    else
        log_success "✓ Server情報が適切に隠蔽されています"
    fi
    
    # X-Powered-Byの隠蔽チェック
    if echo "$response" | grep -qi "X-Powered-By:"; then
        log_warning "✗ X-Powered-By情報が露出しています"
    else
        log_success "✓ X-Powered-By情報が適切に隠蔽されています"
    fi
}

# ============================================================
# CORSテスト
# ============================================================

test_cors() {
    log_info "CORS設定のテストを実行中..."
    
    # 許可されたオリジンからのリクエスト
    local allowed_origin
    if [ "$ENVIRONMENT" = "production" ]; then
        allowed_origin="https://tools.cross-astem.jp"
    else
        allowed_origin="http://localhost:3000"
    fi
    
    local cors_response=$(curl -s -I \
        -H "Origin: $allowed_origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -X OPTIONS \
        "$API_URL/health" 2>/dev/null || echo "")
    
    if echo "$cors_response" | grep -qi "Access-Control-Allow-Origin: $allowed_origin"; then
        log_success "✓ 許可されたオリジンでCORSが正常に動作しています"
    else
        log_warning "✗ CORS設定に問題がある可能性があります"
    fi
    
    # 許可されていないオリジンからのリクエスト
    local blocked_response=$(curl -s -I \
        -H "Origin: https://malicious-site.com" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS \
        "$API_URL/health" 2>/dev/null || echo "")
    
    if echo "$blocked_response" | grep -qi "Access-Control-Allow-Origin: https://malicious-site.com"; then
        log_error "✗ 不正なオリジンからのアクセスが許可されています"
    else
        log_success "✓ 不正なオリジンが適切にブロックされています"
    fi
}

# ============================================================
# レート制限テスト
# ============================================================

test_rate_limiting() {
    log_info "レート制限のテストを実行中..."
    
    # 連続リクエストでレート制限をテスト（軽量）
    local success_count=0
    local rate_limited=false
    
    for i in {1..15}; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
        
        if [ "$status" = "200" ]; then
            ((success_count++))
        elif [ "$status" = "429" ]; then
            rate_limited=true
            break
        fi
        
        sleep 0.1
    done
    
    if [ "$rate_limited" = true ]; then
        log_success "✓ レート制限が正常に動作しています（${success_count}回後に制限）"
    else
        log_warning "✗ レート制限が設定されていない可能性があります"
    fi
}

# ============================================================
# SQLインジェクション攻撃テスト
# ============================================================

test_sql_injection() {
    log_info "SQLインジェクション防御のテストを実行中..."
    
    # 基本的なSQLインジェクション攻撃パターン
    local attack_patterns=(
        "' OR '1'='1"
        "'; DROP TABLE users; --"
        "' UNION SELECT * FROM users --"
        "admin'--"
        "1' OR 1=1#"
    )
    
    local blocked_count=0
    
    for pattern in "${attack_patterns[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" \
            -G "$API_URL/health" \
            --data-urlencode "test=$pattern" 2>/dev/null || echo "000")
        
        if [ "$status" = "403" ] || [ "$status" = "400" ]; then
            ((blocked_count++))
        fi
    done
    
    if [ "$blocked_count" -gt 0 ]; then
        log_success "✓ SQLインジェクション攻撃が ${blocked_count}/${#attack_patterns[@]} パターンでブロックされています"
    else
        log_warning "✗ SQLインジェクション防御が十分でない可能性があります"
    fi
}

# ============================================================
# XSS攻撃テスト
# ============================================================

test_xss_protection() {
    log_info "XSS防御のテストを実行中..."
    
    # XSS攻撃パターン
    local xss_patterns=(
        "<script>alert('xss')</script>"
        "javascript:alert('xss')"
        "<img src=x onerror=alert('xss')>"
        "';alert('xss');//"
    )
    
    local headers_check=false
    
    # XSSプロテクションヘッダーの確認
    local response=$(curl -s -I "$API_URL/health" 2>/dev/null || echo "")
    if echo "$response" | grep -qi "X-XSS-Protection:"; then
        headers_check=true
        log_success "✓ X-XSS-Protectionヘッダーが設定されています"
    else
        log_warning "✗ X-XSS-Protectionヘッダーが見つかりません"
    fi
    
    # Content-Type: nosniffの確認
    if echo "$response" | grep -qi "X-Content-Type-Options: nosniff"; then
        log_success "✓ Content-Type sniffing防御が設定されています"
    else
        log_warning "✗ Content-Type sniffing防御が見つかりません"
    fi
}

# ============================================================
# User-Agent検証テスト
# ============================================================

test_user_agent_filtering() {
    log_info "危険なUser-Agent検証のテストを実行中..."
    
    # 危険なUser-Agentパターン
    local dangerous_agents=(
        "sqlmap/1.0"
        "Nikto/2.1.6"
        "Nmap Scripting Engine"
        "<script>alert('xss')</script>"
    )
    
    local blocked_count=0
    
    for agent in "${dangerous_agents[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "User-Agent: $agent" \
            "$API_URL/health" 2>/dev/null || echo "000")
        
        if [ "$status" = "403" ]; then
            ((blocked_count++))
        fi
    done
    
    if [ "$blocked_count" -gt 0 ]; then
        log_success "✓ 危険なUser-Agentが ${blocked_count}/${#dangerous_agents[@]} パターンでブロックされています"
    else
        log_warning "✗ User-Agent検証が設定されていない可能性があります"
    fi
}

# ============================================================
# 認証エンドポイントテスト
# ============================================================

test_auth_security() {
    log_info "認証エンドポイントのセキュリティテストを実行中..."
    
    # 無効なJWTトークンでのアクセステスト
    local status=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer invalid_token" \
        "$API_URL/agent/stats" 2>/dev/null || echo "000")
    
    if [ "$status" = "401" ]; then
        log_success "✓ 無効なJWTトークンが適切に拒否されています"
    else
        log_warning "✗ JWT認証に問題がある可能性があります"
    fi
    
    # 認証なしでのアクセステスト
    local status_no_auth=$(curl -s -o /dev/null -w "%{http_code}" \
        "$API_URL/agent/stats" 2>/dev/null || echo "000")
    
    if [ "$status_no_auth" = "401" ]; then
        log_success "✓ 認証なしアクセスが適切に拒否されています"
    else
        log_warning "✗ 認証要求が設定されていない可能性があります"
    fi
}

# ============================================================
# SSL/TLS設定テスト（本番環境のみ）
# ============================================================

test_ssl_configuration() {
    if [ "$ENVIRONMENT" != "production" ]; then
        return
    fi
    
    log_info "SSL/TLS設定のテストを実行中..."
    
    # SSL Labs風の簡易テスト
    local ssl_info=$(echo | openssl s_client -connect tools.cross-astem.jp:443 -servername tools.cross-astem.jp 2>/dev/null)
    
    # プロトコルバージョンチェック
    if echo "$ssl_info" | grep -q "TLSv1.3\|TLSv1.2"; then
        log_success "✓ 安全なTLSプロトコルが使用されています"
    else
        log_warning "✗ 古いTLSプロトコルが使用されている可能性があります"
    fi
    
    # 証明書の有効性チェック
    local cert_status=$(curl -s -I "$BASE_URL" 2>&1 | grep -o "HTTP/[0-9.]* [0-9]*" | grep -o "[0-9]*$")
    if [ "$cert_status" = "200" ]; then
        log_success "✓ SSL証明書が有効です"
    else
        log_warning "✗ SSL証明書に問題がある可能性があります"
    fi
}

# ============================================================
# メイン実行
# ============================================================

main() {
    echo ""
    log_info "========================================"
    log_info "AIエージェントサービス セキュリティテスト"
    log_info "========================================"
    echo ""
    
    # 各テストの実行
    test_security_headers
    echo ""
    
    test_cors
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_sql_injection
    echo ""
    
    test_xss_protection
    echo ""
    
    test_user_agent_filtering
    echo ""
    
    test_auth_security
    echo ""
    
    test_ssl_configuration
    echo ""
    
    log_info "========================================"
    log_info "セキュリティテスト完了"
    log_info "========================================"
    echo ""
    
    log_info "詳細なセキュリティテストを実行する場合:"
    echo "  - OWASP ZAP: https://www.zaproxy.org/"
    echo "  - Nmap: nmap -sV --script vuln $API_URL"
    echo "  - SSL Labs: https://www.ssllabs.com/ssltest/"
    echo ""
}

# スクリプト実行
main "$@"