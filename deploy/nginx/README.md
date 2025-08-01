# Nginx + Postfix デプロイメントガイド

**AIエージェントサービス - zm01.ast-tools.online**

## 📋 概要

このディレクトリには、AIエージェントサービスを`zm01.ast-tools.online`でNginx + Postfix構成でデプロイするための完全な資料が含まれています。

## 🗂️ ファイル構成

```
deploy/nginx/
├── README.md                    # このファイル
├── nginx.conf                   # Nginx設定ファイル
├── ssl-setup.md                 # SSL証明書設定ガイド
├── postfix-setup.md            # Postfixメールサーバー設定ガイド
├── deploy.sh                   # 自動デプロイスクリプト
├── ecosystem.production.js     # PM2本番環境設定
└── environment-setup.md        # 環境変数設定ガイド
```

## 🚀 クイックスタート

### 1. 前提条件

- Ubuntu 20.04/22.04 サーバー
- ドメイン `zm01.ast-tools.online` がサーバーIPに設定済み
- root権限またはsudo権限
- 80/443番ポートが利用可能

### 2. 自動セットアップ（推奨）

```bash
# リポジトリクローン
git clone [リポジトリURL] /opt/zm01.ast-tools.online
cd /opt/zm01.ast-tools.online

# デプロイスクリプトに実行権限付与
chmod +x deploy/nginx/deploy.sh

# システムセットアップ
./deploy/nginx/deploy.sh setup

# SSL証明書取得
./deploy/nginx/deploy.sh ssl

# アプリケーションデプロイ
./deploy/nginx/deploy.sh deploy
```

### 3. 手動セットアップ

各設定ファイルの詳細な手順については、対応するマークダウンファイルを参照してください：

1. **[SSL証明書設定](ssl-setup.md)** - Let's Encrypt証明書取得
2. **[Postfix設定](postfix-setup.md)** - メールサーバー構築
3. **[環境変数設定](environment-setup.md)** - セキュア環境変数設定

## 🏗️ アーキテクチャ概要

```
[インターネット] 
       ↓ (HTTPS/443)
    [Nginx]
       ↓ (Proxy)
┌─────────────────┐
│ Frontend (3021) │ ← Next.js
└─────────────────┘
       ↓ (API)
┌─────────────────┐
│ Backend (3020)  │ ← Express.js
└─────────────────┘
       ↓
┌─────────────────┐
│ PostgreSQL      │ ← データベース
└─────────────────┘
       ↓
┌─────────────────┐
│ Redis          │ ← キュー・セッション
└─────────────────┘
       ↓
┌─────────────────┐
│ Postfix        │ ← メール配信
└─────────────────┘
```

## 🔧 設定ファイル詳細

### Nginx設定

- **ファイル**: `nginx.conf`
- **機能**: 
  - HTTPS強制リダイレクト
  - Next.js/Express.jsプロキシ
  - SSL/TLS最適化
  - セキュリティヘッダー
  - レート制限
  - 静的ファイルキャッシュ

### PM2設定

- **ファイル**: `ecosystem.production.js`
- **プロセス構成**:
  - `ai-agent-backend` (3インスタンス)
  - `ai-agent-frontend` (3インスタンス)
  - `ai-agent-transcript-worker` (2インスタンス)
  - `ai-agent-email-worker` (3インスタンス)

### 環境変数

- **ファイル**: `environment-setup.md`
- **主要設定**:
  - データベース接続
  - Redis設定
  - AI API キー (OpenAI/Anthropic)
  - Zoom API設定
  - SMTP設定

## 📊 サービス監視

### ヘルスチェック

```bash
# システム全体の状態確認
./deploy/nginx/deploy.sh status

# 各サービスの状態
systemctl status nginx
systemctl status postgresql
systemctl status redis-server
systemctl status postfix
pm2 status
```

### ログ確認

```bash
# アプリケーションログ
./deploy/nginx/deploy.sh logs app

# Nginxログ
./deploy/nginx/deploy.sh logs nginx

# メールログ
./deploy/nginx/deploy.sh logs mail

# データベースログ
./deploy/nginx/deploy.sh logs db
```

## 🔐 セキュリティ機能

### SSL/TLS

- Let's Encrypt証明書
- TLS 1.2/1.3サポート
- HSTS設定
- セキュリティヘッダー

### アクセス制御

- レート制限
- CORS設定
- 不正アクセス防止
- ファイアウォール設定

### 認証・認可

- JWT認証
- NextAuth.js統合
- ロールベース権限制御

## 🔄 メンテナンス

### バックアップ

```bash
# 自動バックアップ作成
./deploy/nginx/deploy.sh backup

# 手動バックアップ場所
/backup/YYYYMMDD_HHMMSS/
├── app.tar.gz          # アプリケーションファイル
├── database.sql        # データベース
├── nginx.conf          # Nginx設定
└── pm2.json           # PM2設定
```

### 更新・デプロイ

```bash
# アプリケーション更新
./deploy/nginx/deploy.sh deploy

# サービス再起動
./deploy/nginx/deploy.sh restart

# ロールバック（緊急時）
./deploy/nginx/deploy.sh rollback
```

## 📈 パフォーマンス

### 最適化設定

- **Nginx**: gzip圧縮、キャッシュ設定
- **PM2**: クラスター実行、負荷分散
- **PostgreSQL**: 接続プール、インデックス最適化
- **Redis**: メモリ最適化、永続化設定

### 監視指標

- CPU使用率
- メモリ使用率
- ディスク使用量
- ネットワーク帯域
- レスポンス時間
- エラー率

## 🚨 トラブルシューティング

### よくある問題

1. **SSL証明書エラー**
   ```bash
   sudo certbot certificates
   sudo nginx -t
   ```

2. **データベース接続エラー**
   ```bash
   sudo systemctl status postgresql
   sudo -u postgres psql -l
   ```

3. **メール送信失敗**
   ```bash
   sudo systemctl status postfix
   sudo tail -f /var/log/mail.log
   ```

4. **アプリケーション起動失敗**
   ```bash
   pm2 logs
   pm2 monit
   ```

### 緊急時対応

```bash
# 全サービス再起動
sudo systemctl restart nginx postgresql redis-server postfix
pm2 restart all

# ロールバック実行
./deploy/nginx/deploy.sh rollback

# 緊急メンテナンスモード
# nginx.confでmaintenance.htmlに一時的にリダイレクト
```

## 📞 サポート

### ログの場所

```bash
# アプリケーションログ
/var/log/ai-agent/

# システムログ
/var/log/nginx/
/var/log/postgresql/
/var/log/mail.log

# PM2ログ
~/.pm2/logs/
```

### 設定ファイルの場所

```bash
# Nginx設定
/etc/nginx/sites-available/zm01.ast-tools.online

# PostgreSQL設定
/etc/postgresql/14/main/postgresql.conf

# Redis設定
/etc/redis/redis.conf

# Postfix設定
/etc/postfix/main.cf

# 環境変数
/opt/zm01.ast-tools.online/.env.production
```

## 🎯 本番運用チェックリスト

### デプロイ前確認

- [ ] ドメインDNS設定完了
- [ ] サーバーリソース確認
- [ ] バックアップ体制確立
- [ ] 監視システム設定

### デプロイ後確認

- [ ] SSL証明書正常動作
- [ ] 全サービス起動確認
- [ ] ヘルスチェック通過
- [ ] メール配信テスト完了
- [ ] パフォーマンステスト完了

### 定期メンテナンス

- [ ] SSL証明書更新確認（月次）
- [ ] ログローテーション確認（週次）
- [ ] セキュリティアップデート（月次）
- [ ] バックアップテスト（月次）
- [ ] パフォーマンス監視（日次）

---

## 📄 ライセンス

このデプロイメント資料は、AIエージェントサービスプロジェクトの一部として提供されています。

## 🔗 関連リンク

- [プロジェクト本体](../../README.md)
- [開発環境セットアップ](../../docs/development.md)
- [APIドキュメント](../../docs/api.md)

---

**最終更新**: 2025年7月14日  
**バージョン**: 1.0.0  
**対象ドメイン**: zm01.ast-tools.online