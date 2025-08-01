# SSL証明書設定ガイド - zm01.ast-tools.online

## 概要

Let's Encryptを使用してzm01.ast-tools.online用のSSL証明書を取得・設定する手順です。

## 前提条件

- Ubuntu 20.04/22.04サーバー
- ドメイン `zm01.ast-tools.online` がサーバーIPに向いている
- root権限またはsudo権限
- 80番ポートが利用可能

## 1. Certbot インストール

### snapを使用したインストール（推奨）

```bash
# snapの更新
sudo snap install core; sudo snap refresh core

# 既存のcertbotを削除（apt経由でインストールされている場合）
sudo apt remove certbot

# Certbotのインストール
sudo snap install --classic certbot

# コマンドのリンク作成
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

### aptを使用したインストール（代替手段）

```bash
# リポジトリ更新
sudo apt update

# Certbotとnginxプラグインのインストール
sudo apt install certbot python3-certbot-nginx

# 確認
certbot --version
```

## 2. Nginx基本設定

証明書取得前に、HTTP用の基本設定を作成：

```bash
# 設定ディレクトリ作成
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# 基本設定作成
sudo tee /etc/nginx/sites-available/zm01.ast-tools.online > /dev/null << 'EOF'
server {
    listen 80;
    server_name zm01.ast-tools.online;
    
    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # 一時的にメンテナンスページを表示
    location / {
        root /var/www/html;
        index maintenance.html index.html;
    }
}
EOF

# 設定の有効化
sudo ln -sf /etc/nginx/sites-available/zm01.ast-tools.online /etc/nginx/sites-enabled/

# メンテナンスページ作成
sudo mkdir -p /var/www/html
sudo tee /var/www/html/maintenance.html > /dev/null << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Setup in Progress - ZM01</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #333; }
        p { color: #666; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ZM01 AI Agent Service</h1>
        <p>システムセットアップ中です。しばらくお待ちください。</p>
        <p>Setup in progress. Please wait...</p>
    </div>
</body>
</html>
EOF

# Nginx設定テスト
sudo nginx -t

# Nginx再起動
sudo systemctl restart nginx
```

## 3. SSL証明書取得

### 自動設定モード（推奨）

```bash
# Nginxプラグインを使用した自動設定
sudo certbot --nginx -d zm01.ast-tools.online

# 対話形式で以下を選択：
# 1. メールアドレス入力
# 2. 利用規約に同意 (A)
# 3. EFFからのメール受信 (Y/N - お好みで)
# 4. リダイレクト設定 → 2 (HTTPSにリダイレクト) を選択
```

### 手動設定モード

```bash
# 証明書のみ取得
sudo certbot certonly --webroot -w /var/www/html -d zm01.ast-tools.online

# 取得後に手動でnginx設定を更新（後述）
```

## 4. 証明書確認

```bash
# 証明書ファイルの確認
sudo ls -la /etc/letsencrypt/live/zm01.ast-tools.online/

# 期待されるファイル:
# cert.pem       - ドメイン証明書
# chain.pem      - 中間証明書
# fullchain.pem  - cert.pem + chain.pem
# privkey.pem    - 秘密鍵

# 証明書内容の確認
sudo openssl x509 -text -noout -in /etc/letsencrypt/live/zm01.ast-tools.online/cert.pem

# 有効期限確認
sudo certbot certificates
```

## 5. 最終Nginx設定適用

自動設定後、AIエージェント用の完全設定に置き換え：

```bash
# 本番設定をコピー
sudo cp /path/to/deploy/nginx/nginx.conf /etc/nginx/sites-available/zm01.ast-tools.online

# Nginx設定テスト
sudo nginx -t

# 問題なければ再起動
sudo systemctl restart nginx
```

## 6. 自動更新設定

Let's Encrypt証明書は90日で期限切れのため、自動更新を設定：

```bash
# 更新テスト（実際には更新されない）
sudo certbot renew --dry-run

# 自動更新確認（snapでインストールした場合は自動設定済み）
sudo systemctl list-timers snap.certbot.renew.timer

# crontabで設定する場合（aptインストール時）
sudo crontab -e

# 以下を追加（毎日午前2時に更新チェック）
0 2 * * * /usr/bin/certbot renew --quiet && /usr/bin/systemctl reload nginx
```

## 7. ファイアウォール設定

```bash
# UFWの状態確認
sudo ufw status

# HTTP/HTTPS ポートを開放
sudo ufw allow 'Nginx Full'

# または個別に開放
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 設定確認
sudo ufw status numbered
```

## 8. セキュリティテスト

### SSL設定の確認

```bash
# SSL Labsでテスト（ブラウザで開く）
echo "https://www.ssllabs.com/ssltest/analyze.html?d=zm01.ast-tools.online"

# コマンドラインでの簡易テスト
curl -I https://zm01.ast-tools.online

# 証明書チェーン確認
openssl s_client -connect zm01.ast-tools.online:443 -servername zm01.ast-tools.online
```

### セキュリティヘッダー確認

```bash
# セキュリティヘッダーの確認
curl -I https://zm01.ast-tools.online | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"

# セキュリティスキャン（外部サービス）
echo "https://securityheaders.com/?q=zm01.ast-tools.online"
```

## 9. トラブルシューティング

### よくある問題

#### 1. ドメイン解決エラー

```bash
# DNS確認
nslookup zm01.ast-tools.online

# 現在のIP確認
curl ifconfig.me

# Aレコード確認
dig A zm01.ast-tools.online
```

#### 2. ポート80が使用中

```bash
# ポート使用状況確認
sudo netstat -tlnp | grep :80

# Apacheが動いている場合は停止
sudo systemctl stop apache2
sudo systemctl disable apache2
```

#### 3. Nginx設定エラー

```bash
# 設定確認
sudo nginx -t

# エラーログ確認
sudo tail -f /var/log/nginx/error.log

# アクセスログ確認
sudo tail -f /var/log/nginx/access.log
```

#### 4. 証明書更新失敗

```bash
# 詳細ログで更新テスト
sudo certbot renew --dry-run --verbose

# 強制更新（期限内でも実行）
sudo certbot renew --force-renewal

# Webroot確認
sudo ls -la /var/www/html/.well-known/acme-challenge/
```

## 10. 証明書ファイルパス

設定ファイルで使用するパス：

```nginx
# SSL証明書設定
ssl_certificate /etc/letsencrypt/live/zm01.ast-tools.online/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/zm01.ast-tools.online/privkey.pem;
ssl_trusted_certificate /etc/letsencrypt/live/zm01.ast-tools.online/chain.pem;
```

## 11. 本番運用での注意事項

### 証明書権限設定

```bash
# Let's Encryptファイルの権限確認
sudo ls -la /etc/letsencrypt/live/zm01.ast-tools.online/

# Nginxユーザーでアクセス可能か確認
sudo -u www-data ls /etc/letsencrypt/live/zm01.ast-tools.online/
```

### ログローテーション

```bash
# Nginxログローテーション設定
sudo tee /etc/logrotate.d/zm01-nginx > /dev/null << 'EOF'
/var/log/nginx/zm01.*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi \
    endscript
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1
    endscript
}
EOF
```

### 監視設定

```bash
# SSL証明書期限監視スクリプト
sudo tee /usr/local/bin/ssl-check.sh > /dev/null << 'EOF'
#!/bin/bash
DOMAIN="zm01.ast-tools.online"
THRESHOLD=30  # 30日前に警告

EXPIRY_DATE=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/cert.pem | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_LEFT -le $THRESHOLD ]; then
    echo "SSL certificate for $DOMAIN will expire in $DAYS_LEFT days"
    # メール送信などの処理を追加
fi
EOF

sudo chmod +x /usr/local/bin/ssl-check.sh

# 日次チェック設定
echo "0 9 * * * /usr/local/bin/ssl-check.sh" | sudo crontab -
```

## 12. 完了確認チェックリスト

- [ ] ドメインDNS設定完了
- [ ] Certbotインストール完了
- [ ] SSL証明書取得完了
- [ ] Nginx設定適用完了
- [ ] HTTPS接続確認完了
- [ ] セキュリティヘッダー確認完了
- [ ] 自動更新設定完了
- [ ] ファイアウォール設定完了
- [ ] 証明書期限監視設定完了
- [ ] ログローテーション設定完了

## 緊急時連絡先・リファレンス

- Let's Encrypt公式: https://letsencrypt.org/
- Certbot公式: https://certbot.eff.org/
- SSL Labs テスト: https://www.ssllabs.com/ssltest/
- Security Headers: https://securityheaders.com/