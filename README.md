# AIエージェントサービス - Zoom議事録自動配布システム

Zoom会議終了後に議事録を自動生成・配布するAIエージェントサービスです。

## 概要

このシステムは以下の機能を提供します：

- 🎥 **Zoom Webhook受信**: 会議終了を自動検知
- 🤖 **AI議事録生成**: OpenAI Whisper + Claude APIで自動文字起こし・整形
- 📧 **自動配布**: メール、ワークフローAPI、Slack連携
- 📊 **管理画面**: Next.js App Routerによる管理インターフェース
- 🔐 **認証システム**: NextAuth.jsによる安全な認証

## 技術スタック

### バックエンド
- **Node.js + Express.js**: RESTful API サーバー
- **PostgreSQL**: データベース
- **Redis**: キューシステム（Bull Queue）
- **JWT**: 認証トークン

### フロントエンド
- **Next.js 15 App Router**: React フレームワーク
- **TypeScript**: 型安全性
- **Tailwind CSS**: スタイリング
- **NextAuth.js**: 認証システム

### AI・外部サービス
- **OpenAI Whisper API**: 音声文字起こし
- **Anthropic Claude API**: 議事録整形・要約
- **Zoom API**: 会議データ取得
- **Nodemailer**: メール配信

## プロジェクト構造

```
ai-agent-service/
├── backend/                    # Express.js API Server
│   ├── routes/                # API ルート
│   ├── middleware/            # 認証・バリデーション
│   ├── services/              # ビジネスロジック
│   ├── workers/               # バックグラウンド処理
│   ├── models/                # データモデル
│   ├── utils/                 # ユーティリティ
│   └── migrations/            # データベーススキーマ
├── frontend/                   # Next.js App Router
│   ├── app/                   # App Router ページ
│   ├── components/            # React コンポーネント
│   ├── lib/                   # ライブラリ・設定
│   ├── hooks/                 # カスタムフック
│   └── types/                 # TypeScript 型定義
├── docker-compose.yml         # Docker 構成
└── .env.development          # 環境変数
```

## セットアップ手順

### 1. 前提条件

- Docker & Docker Compose
- Node.js 18+ (ローカル開発時)
- 以下のAPIキー:
  - OpenAI API Key
  - Anthropic API Key
  - Zoom API Key & Secret

### 2. プロジェクトのクローン

```bash
cd ai-agent-service
```

### 3. 環境変数の設定

`.env.development` ファイルで以下を設定：

```bash
# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Zoom API
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
ZOOM_WEBHOOK_SECRET=your_webhook_secret

# Email Settings
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

### 4. Docker Compose でサービス起動

```bash
# すべてのサービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f

# 特定のサービスのログを確認
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 5. アクセス確認

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 6. ログイン情報

デフォルト管理者アカウント：
- **メール**: admin@example.com
- **パスワード**: DemoPassword123

## 開発者向け情報

### APIエンドポイント

#### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - ユーザー情報取得

#### エージェントジョブ
- `GET /api/agent/jobs` - ジョブ一覧
- `GET /api/agent/jobs/:id` - ジョブ詳細
- `GET /api/agent/stats` - 統計情報

#### 議事録
- `GET /api/transcripts` - 議事録一覧
- `GET /api/transcripts/:id` - 議事録詳細
- `PUT /api/transcripts/:id` - 議事録編集
- `POST /api/transcripts/:id/redistribute` - 再配布

#### Webhook
- `POST /api/webhooks/zoom` - Zoom Webhook受信

### データベーススキーマ

主要テーブル：
- `users` - ユーザー管理
- `agent_jobs` - ジョブ管理
- `meeting_transcripts` - 議事録
- `distribution_logs` - 配布履歴
- `agent_settings` - システム設定

### 開発環境での作業

```bash
# バックエンド（ローカル開発）
cd backend
npm install
npm run dev

# フロントエンド（ローカル開発）
cd frontend
npm install
npm run dev
```

### データベース操作

```bash
# PostgreSQLに接続
docker-compose exec db psql -U postgres -d ai_agent_dev

# テーブル一覧表示
\dt

# ユーザー一覧表示
SELECT id, email, name, role FROM users;
```

## トラブルシューティング

### よくある問題

1. **ポート競合エラー**
   ```bash
   # 使用中のポートを確認
   lsof -i :3000
   lsof -i :8000
   ```

2. **データベース接続エラー**
   ```bash
   # データベースサービスの再起動
   docker-compose restart db
   ```

3. **Redis接続エラー**
   ```bash
   # Redisサービスの再起動
   docker-compose restart redis
   ```

### ログの確認

```bash
# 全サービスのログ
docker-compose logs

# 特定サービスのログ（リアルタイム）
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### 環境のリセット

```bash
# すべてのコンテナ・ボリュームを削除
docker-compose down -v

# 再構築
docker-compose up -d --build
```

## 本番環境構成

本番環境ではPM2を使用した構成を想定しています：

```bash
# バックエンド（PM2）
npm install -g pm2
pm2 start ecosystem.config.js

# フロントエンド（Next.js本番ビルド）
npm run build
pm2 start ecosystem.config.js
```

## ライセンス

MIT License

## 開発チーム

AI Agent Service Team

## サポート

問題や質問がある場合は、以下のチャンネルでお問い合わせください：
- GitHub Issues
- 開発チームへの直接連絡