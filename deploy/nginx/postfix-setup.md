# Postfix メールサーバー設定ガイド - zm01.ast-tools.online

## 概要

AIエージェントサービスの議事録配信用にPostfixメールサーバーを設定する手順です。
SMTP認証なしのローカル配信とSMTP認証ありの外部配信の両方に対応します。

## 1. Postfix インストール

### Ubuntu 20.04/22.04

```bash
# パッケージ更新
sudo apt update

# Postfixとメール関連ツールのインストール
sudo apt install postfix mailutils

# インストール時の設定選択:
# 1. "Internet Site" を選択
# 2. System mail name: "zm01.ast-tools.online" を入力
```

### インストール後確認

```bash
# Postfixバージョン確認
postconf mail_version

# 基本設定確認
postconf -n

# サービス状態確認
sudo systemctl status postfix
```

## 2. 基本設定ファイル

### メイン設定ファイル

```bash
# 既存設定のバックアップ
sudo cp /etc/postfix/main.cf /etc/postfix/main.cf.backup

# 基本設定の作成
sudo tee /etc/postfix/main.cf > /dev/null << 'EOF'
# ========================================================
# Postfix メイン設定 - zm01.ast-tools.online
# AIエージェントサービス用メールサーバー
# ========================================================

# 基本情報
myhostname = zm01.ast-tools.online
mydomain = ast-tools.online
myorigin = $mydomain

# ネットワーク設定
inet_interfaces = loopback-only
inet_protocols = ipv4

# 配信設定
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128

# リレー設定（内部のみ）
relayhost = 
relay_domains = 

# メールボックス設定
home_mailbox = Maildir/
mailbox_command = 

# セキュリティ設定
smtpd_banner = $myhostname ESMTP $mail_name
biff = no
append_dot_mydomain = no
readme_directory = no

# TLS設定（送信時）
smtp_use_tls = yes
smtp_tls_CApath = /etc/ssl/certs
smtp_tls_security_level = may
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache

# TLS設定（受信時）
smtpd_use_tls = yes
smtpd_tls_cert_file = /etc/letsencrypt/live/zm01.ast-tools.online/fullchain.pem
smtpd_tls_key_file = /etc/letsencrypt/live/zm01.ast-tools.online/privkey.pem
smtpd_tls_CApath = /etc/ssl/certs
smtpd_tls_security_level = may
smtpd_tls_session_cache_database = btree:${data_directory}/smtpd_scache

# 認証設定（SASL）
smtpd_sasl_auth_enable = no
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth

# アクセス制御
smtpd_recipient_restrictions = 
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination

smtpd_sender_restrictions = 
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unknown_sender_domain

# メッセージサイズ制限
message_size_limit = 26214400  # 25MB
mailbox_size_limit = 0

# アドレス書き換え
canonical_maps = hash:/etc/postfix/canonical
sender_canonical_maps = hash:/etc/postfix/sender_canonical

# ログ設定
syslog_facility = mail
syslog_name = postfix

# その他
compatibility_level = 2
EOF
```

### マスター設定ファイル（基本的にはデフォルトのまま）

```bash
# master.cfの確認（通常は変更不要）
sudo postconf -M
```

## 3. アドレス書き換え設定

AIエージェントサービス用のアドレス書き換えを設定：

### Canonical マッピング

```bash
# 正規アドレスマッピング
sudo tee /etc/postfix/canonical > /dev/null << 'EOF'
# AIエージェントサービス用アドレス書き換え
ai-agent@zm01.ast-tools.online    noreply@zm01.ast-tools.online
transcript@zm01.ast-tools.online  noreply@zm01.ast-tools.online
system@zm01.ast-tools.online      noreply@zm01.ast-tools.online
EOF

# ハッシュ化
sudo postmap /etc/postfix/canonical
```

### 送信者アドレス書き換え

```bash
# 送信者アドレス統一
sudo tee /etc/postfix/sender_canonical > /dev/null << 'EOF'
# システムアカウントを統一送信者に変更
root@zm01.ast-tools.online        noreply@zm01.ast-tools.online
www-data@zm01.ast-tools.online    noreply@zm01.ast-tools.online
ubuntu@zm01.ast-tools.online      noreply@zm01.ast-tools.online
EOF

# ハッシュ化
sudo postmap /etc/postfix/sender_canonical
```

## 4. SSL/TLS証明書設定

Let's Encryptの証明書をPostfixで使用：

```bash
# 証明書ファイルの権限確認
sudo ls -la /etc/letsencrypt/live/zm01.ast-tools.online/

# Postfixユーザーがアクセスできるようにグループ追加
sudo usermod -a -G ssl-cert postfix

# 証明書へのアクセス権限付与
sudo chmod 755 /etc/letsencrypt/live/
sudo chmod 755 /etc/letsencrypt/archive/
```

## 5. ファイアウォール設定

メール送信用のポート設定：

```bash
# SMTPポート（25）を開放（内部送信用）
sudo ufw allow from 127.0.0.1 to any port 25

# SMTP submission（587）を開放（必要に応じて）
# sudo ufw allow 587/tcp

# SMTPS（465）を開放（必要に応じて）
# sudo ufw allow 465/tcp

# 設定確認
sudo ufw status numbered
```

## 6. Node.js アプリケーション設定

AIエージェントサービス用の環境変数設定：

### 本番環境変数

```bash
# /opt/zm01.ast-tools.online/.env.production の例
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@zm01.ast-tools.online
SMTP_FROM_NAME=ZM01 AI Agent Service
```

### PM2 ecosystem設定

```javascript
// ecosystem.config.js の環境変数
module.exports = {
  apps: [{
    name: 'ai-agent-backend',
    // ... その他設定
    env_production: {
      // ... その他環境変数
      SMTP_HOST: 'localhost',
      SMTP_PORT: 25,
      SMTP_SECURE: false,
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: 'noreply@zm01.ast-tools.online',
      SMTP_FROM_NAME: 'ZM01 AI Agent Service'
    }
  }]
};
```

## 7. サービス設定と起動

```bash
# Postfix設定確認
sudo postfix check

# 設定再読み込み
sudo systemctl reload postfix

# サービス起動・有効化
sudo systemctl start postfix
sudo systemctl enable postfix

# 状態確認
sudo systemctl status postfix

# ログ確認
sudo journalctl -u postfix -f
```

## 8. テスト配信

### ローカルテスト

```bash
# 基本的なメール送信テスト
echo "This is a test email from ZM01 AI Agent Service" | mail -s "Test Email" test@example.com

# Postfixキューの確認
sudo postqueue -p

# メールログ確認
sudo tail -f /var/log/mail.log
```

### Node.js からのテスト

```javascript
// test-email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

const mailOptions = {
  from: 'noreply@zm01.ast-tools.online',
  to: 'test@example.com',
  subject: 'ZM01 AI Agent Test Email',
  text: 'This is a test email from ZM01 AI Agent Service',
  html: '<h1>ZM01 AI Agent Service</h1><p>This is a test email</p>'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Email sent:', info.response);
  }
});
```

```bash
# テスト実行
cd /opt/zm01.ast-tools.online/backend
node test-email.js
```

## 9. 外部SMTP連携（オプション）

Gmail、SendGrid等の外部SMTPを使用する場合の設定：

### Gmail SMTP設定例

```bash
# 環境変数設定
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME=ZM01 AI Agent Service
```

### SendGrid設定例

```bash
# 環境変数設定
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@zm01.ast-tools.online
SMTP_FROM_NAME=ZM01 AI Agent Service
```

## 10. ログ監視・ローテーション

### ログローテーション設定

```bash
# メールログローテーション
sudo tee /etc/logrotate.d/zm01-mail > /dev/null << 'EOF'
/var/log/mail.log
/var/log/mail.info
/var/log/mail.warn
/var/log/mail.err
{
    daily
    missingok
    rotate 14
    compress
    delaycompress
    sharedscripts
    postrotate
        /usr/lib/rsyslog/rsyslog-rotate
    endscript
}
EOF
```

### メール配信監視スクリプト

```bash
# メール送信監視スクリプト
sudo tee /usr/local/bin/mail-monitor.sh > /dev/null << 'EOF'
#!/bin/bash

# キューに残っているメール数をチェック
QUEUE_COUNT=$(postqueue -p | tail -1 | awk '{print $5}')

if [ "$QUEUE_COUNT" != "empty" ] && [ $QUEUE_COUNT -gt 10 ]; then
    echo "Warning: $QUEUE_COUNT emails in Postfix queue"
    # アラート送信処理を追加
fi

# エラーログチェック
ERROR_COUNT=$(grep -c "status=bounced\|status=deferred" /var/log/mail.log)

if [ $ERROR_COUNT -gt 5 ]; then
    echo "Warning: $ERROR_COUNT mail delivery errors detected"
    # アラート送信処理を追加
fi
EOF

sudo chmod +x /usr/local/bin/mail-monitor.sh

# 定期実行設定
echo "*/15 * * * * /usr/local/bin/mail-monitor.sh" | sudo crontab -
```

## 11. セキュリティ強化

### SPF レコード設定

DNSにSPFレコードを追加：

```
zm01.ast-tools.online.  TXT  "v=spf1 ip4:YOUR_SERVER_IP ~all"
```

### DKIM設定（オプション）

```bash
# OpenDKIMインストール
sudo apt install opendkim opendkim-tools

# 設定ファイル作成
sudo tee /etc/opendkim.conf > /dev/null << 'EOF'
Domain zm01.ast-tools.online
KeyFile /etc/opendkim/keys/zm01.ast-tools.online/default.private
Selector default
Socket inet:8891@localhost
EOF

# 鍵生成
sudo mkdir -p /etc/opendkim/keys/zm01.ast-tools.online
sudo opendkim-genkey -s default -d zm01.ast-tools.online -D /etc/opendkim/keys/zm01.ast-tools.online
sudo chown opendkim:opendkim /etc/opendkim/keys/zm01.ast-tools.online/default.private

# Postfix設定に追加
echo "milter_default_action = accept" | sudo tee -a /etc/postfix/main.cf
echo "milter_protocol = 2" | sudo tee -a /etc/postfix/main.cf
echo "smtpd_milters = inet:localhost:8891" | sudo tee -a /etc/postfix/main.cf
echo "non_smtpd_milters = inet:localhost:8891" | sudo tee -a /etc/postfix/main.cf
```

## 12. トラブルシューティング

### よくある問題

#### 1. メール送信失敗

```bash
# Postfixログ確認
sudo tail -f /var/log/mail.log

# キュー確認
sudo postqueue -p

# 詳細な配信試行
sudo postqueue -f
```

#### 2. TLS証明書エラー

```bash
# 証明書権限確認
sudo ls -la /etc/letsencrypt/live/zm01.ast-tools.online/

# Postfixで証明書テスト
sudo postfix tls all-info
```

#### 3. 権限エラー

```bash
# Postfixユーザー確認
id postfix

# ログディレクトリ権限
sudo ls -la /var/log/

# スプールディレクトリ権限
sudo ls -la /var/spool/postfix/
```

## 13. メンテナンス

### 定期メンテナンス

```bash
# キューのクリーンアップ（週次）
sudo postsuper -d ALL deferred

# ログのクリーンアップ（日次）
sudo find /var/log -name "mail.log.*" -mtime +30 -delete

# 設定の検証（日次）
sudo postfix check
```

### バックアップ

```bash
# 設定ファイルバックアップ
sudo tar czf /backup/postfix-config-$(date +%Y%m%d).tar.gz /etc/postfix/

# メールスプールバックアップ（必要に応じて）
sudo tar czf /backup/postfix-spool-$(date +%Y%m%d).tar.gz /var/spool/postfix/
```

## 14. 完了確認チェックリスト

- [ ] Postfixインストール完了
- [ ] 基本設定ファイル作成完了
- [ ] SSL証明書設定完了
- [ ] アドレス書き換え設定完了
- [ ] ファイアウォール設定完了
- [ ] サービス起動・有効化完了
- [ ] ローカルメール送信テスト完了
- [ ] Node.jsからの送信テスト完了
- [ ] ログ監視設定完了
- [ ] セキュリティ設定完了
- [ ] メンテナンススクリプト設定完了

## 参考リンク

- Postfix公式ドキュメント: http://www.postfix.org/documentation.html
- Ubuntu Postfixガイド: https://ubuntu.com/server/docs/mail-postfix
- Let's Encrypt + Postfix: https://certbot.eff.org/instructions