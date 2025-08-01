# Apache2 Zoom Webhook設定手順

## 1. 本番サーバーにSSH接続

```bash
ssh ubuntu@tools.cross-astem.jp
```

## 2. 現在のApache2設定確認

```bash
# VirtualHost設定ファイルの場所確認
sudo ls -la /etc/apache2/sites-available/

# 現在の設定ファイル表示
sudo cat /etc/apache2/sites-available/tools.cross-astem.jp.conf
```

## 3. 設定ファイルのバックアップ

```bash
# バックアップ作成
sudo cp /etc/apache2/sites-available/tools.cross-astem.jp.conf /etc/apache2/sites-available/tools.cross-astem.jp.conf.backup.$(date +%Y%m%d_%H%M%S)
```

## 4. 設定ファイル編集

```bash
# ファイル編集
sudo nano /etc/apache2/sites-available/tools.cross-astem.jp.conf
```

## 5. 追加する設定内容

既存の `/zm/` 設定の**前**に以下を追加：

```apache
    # Zoom Webhook専用設定（最優先）
    <Location "/zm/api/webhooks/zoom">
        ProxyPass "http://localhost:3020/api/webhooks/zoom"
        ProxyPassReverse "http://localhost:3020/api/webhooks/zoom"
        ProxyPreserveHost On
        
        # レスポンス保持設定
        ProxyTimeout 30
        SetEnv proxy-nokeepalive 1
        
        # ログ出力
        LogLevel info
        CustomLog ${APACHE_LOG_DIR}/webhook.log combined
    </Location>
```

## 6. 設定構文チェック

```bash
# Apache2設定の構文チェック
sudo apache2ctl configtest
```

## 7. Apache2再起動

```bash
# 設定反映
sudo systemctl reload apache2

# または完全再起動
sudo systemctl restart apache2
```

## 8. ログ確認

```bash
# Apache2アクセスログ
sudo tail -f /var/log/apache2/access.log

# Webhook専用ログ（設定した場合）
sudo tail -f /var/log/apache2/webhook.log
```

## 9. 動作確認

```bash
# Apache2経由でのテスト
curl -X POST https://tools.cross-astem.jp/zm/api/webhooks/zoom \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'
```

## 設定例（完全版）

```apache
<VirtualHost *:443>
    ServerName tools.cross-astem.jp
    
    # SSL設定（既存）
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/private.key
    
    # Zoom Webhook専用設定（最優先）
    <Location "/zm/api/webhooks/zoom">
        ProxyPass "http://localhost:3020/api/webhooks/zoom"
        ProxyPassReverse "http://localhost:3020/api/webhooks/zoom"
        ProxyPreserveHost On
        ProxyTimeout 30
        SetEnv proxy-nokeepalive 1
    </Location>
    
    # その他のAPI設定
    ProxyPass /zm/api/ http://localhost:3020/api/
    ProxyPassReverse /zm/api/ http://localhost:3020/api/
    
    # フロントエンド設定
    ProxyPass /zm/ http://localhost:3021/zm/
    ProxyPassReverse /zm/ http://localhost:3021/zm/
    
    # その他の設定...
</VirtualHost>
```

## トラブルシューティング

### 設定が反映されない場合
```bash
# Apache2の状態確認
sudo systemctl status apache2

# 設定ファイルの再読み込み
sudo systemctl reload apache2
```

### エラーログ確認
```bash
# Apache2エラーログ
sudo tail -f /var/log/apache2/error.log
```

### 設定を元に戻す場合
```bash
# バックアップから復元
sudo cp /etc/apache2/sites-available/tools.cross-astem.jp.conf.backup.* /etc/apache2/sites-available/tools.cross-astem.jp.conf
sudo systemctl reload apache2
```