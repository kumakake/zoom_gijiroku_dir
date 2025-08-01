# AIエージェント：Zoom議事録

作成日時: 2025年7月1日 14:26

# AIエージェント機能仕様書 - Zoom議事録自動配布システム

## 概要

既存のワークフローサービスに、Zoom会議終了後の議事録自動生成・配布機能を追加する。

## 重要な指示事項

### 言語設定

- **すべてのメッセージは日本語で記述してください**
- コードコメントも日本語で記述
- エラーメッセージ、ログ出力も日本語化
- ただし、変数名・関数名・ファイル名は英語のまま維持

## 技術スタック

- **バックエンド**: Node.js + Express.js + PostgreSQL
- **フロントエンド**: Next.js 15 App Router + TypeScript
- **認証**: NextAuth.js（独立認証システム）
- **外部API**: Zoom API, OpenAI Whisper API, Anthropic Claude API
- **キューシステム**: Bull Queue + Redis
- **通知**: メール送信（Nodemailer）, ワークフローAPI連携, Slack API
- **開発環境**: Docker Compose
- **本番環境**: PM2
- **コーディング規約**: タブインデント（1タブ=4スペース相当）

## システム構成

### 1. データベーススキーマ

```sql
-- ユーザー管理テーブル（独立認証用）
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- OAuth使用時はNULL可
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- セッション管理テーブル（NextAuth.js用）
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255)
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMP NOT NULL
);

-- AIエージェントジョブ管理テーブル
CREATE TABLE agent_jobs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'zoom_transcript', 'meeting_summary', etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_by INTEGER REFERENCES users(id), -- ジョブ実行者
    trigger_data JSONB, -- トリガーとなったデータ（Zoom webhook内容など）
    input_data JSONB, -- 処理に必要な入力データ
    output_data JSONB, -- 処理結果
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 議事録管理テーブル
CREATE TABLE meeting_transcripts (
    id SERIAL PRIMARY KEY,
    agent_job_id INTEGER REFERENCES agent_jobs(id),
    zoom_meeting_id VARCHAR(100) UNIQUE NOT NULL,
    meeting_topic VARCHAR(500),
    start_time TIMESTAMP,
    duration INTEGER, -- 分単位
    participants JSONB, -- 参加者情報の配列
    raw_transcript TEXT, -- 生の文字起こし
    formatted_transcript TEXT, -- 整形された議事録
    summary TEXT, -- 要約
    action_items JSONB, -- アクションアイテムの配列
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配布履歴テーブル
CREATE TABLE distribution_logs (
    id SERIAL PRIMARY KEY,
    transcript_id INTEGER REFERENCES meeting_transcripts(id),
    recipient_type VARCHAR(20) NOT NULL, -- 'email', 'workflow_api', 'slack'
    recipient_id VARCHAR(200) NOT NULL, -- メールアドレス、API endpoint、SlackチャンネルIDなど
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- エージェント設定テーブル
CREATE TABLE agent_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

### 2. APIエンドポイント設計

### バックエンドAPI (Express.js)

```jsx
// 認証関連
POST /api/auth/register
// Body: { email, name, password }

POST /api/auth/login
// Body: { email, password }

// Zoom Webhook受信
POST /api/webhooks/zoom
// Body: Zoom webhook payload

// エージェントジョブ一覧取得（認証必須）
GET /api/agent/jobs?page=1&limit=20&status=completed
// Headers: Authorization: Bearer <token>

// エージェントジョブ詳細取得
GET /api/agent/jobs/:jobId

// 議事録一覧取得
GET /api/transcripts?page=1&limit=20

// 議事録詳細取得
GET /api/transcripts/:transcriptId

// 議事録手動編集（管理者のみ）
PUT /api/transcripts/:transcriptId
// Body: { formatted_transcript, summary, action_items }

// 議事録再配布
POST /api/transcripts/:transcriptId/redistribute
// Body: { recipients: [{ type: 'email', id: 'user@example.com' }, { type: 'workflow_api', id: '/workflows/meeting-follow-up' }] }

// エージェント設定取得（管理者のみ）
GET /api/agent/settings

// エージェント設定更新（管理者のみ）
PUT /api/agent/settings
// Body: { smtp_settings, workflow_api_endpoints, slack_webhook_url, default_email_recipients, transcript_template }

```

### Next.js API Routes (認証処理)

```jsx
// NextAuth.js設定
app/api/auth/[...nextauth]/route.ts

// フロントエンド用プロキシAPI（必要に応じて）
app/api/transcripts/route.ts
app/api/jobs/route.ts

```

### 3. フロントエンド画面構成（Next.js App Router）

### 3.0 認証画面

**パス**: `/login`, `/register`

- メール・パスワード認証
- OAuth連携（Google/GitHub等）
- パスワードリセット機能

### 3.1 エージェント管理ダッシュボード

**パス**: `/dashboard`

- 実行中・完了・失敗したジョブの統計表示
- 最近の実行履歴（Server Components使用）
- 各ジョブのステータス（リアルタイム更新）

### 3.2 議事録一覧画面

**パス**: `/transcripts`

- 生成された議事録の一覧表示
- フィルタリング機能（日付、参加者、キーワード）
- 各議事録の配布状況表示
- ページネーション（Server Components）

### 3.3 議事録詳細・編集画面

**パス**: `/transcripts/[id]`

- 議事録の詳細表示
- インライン編集機能（Server Actions使用）
- アクションアイテムの管理
- 配布履歴の確認
- 再配布ボタン

### 3.4 エージェント設定画面（管理者のみ）

**パス**: `/settings`

- Zoom API設定
- メール配信設定（優先度1）
- ワークフローAPI連携設定（優先度2）
- Slack連携設定（優先度3）
- 議事録テンプレート設定
- デフォルト配布先設定

### 4. 処理フロー

### 4.1 メイン処理フロー

```
1. Zoom Webhook受信 → agent_jobsテーブルに記録
2. キューに処理ジョブ追加
3. バックグラウンド処理開始
   a. Zoom APIから録音データ取得
   b. Whisper APIで文字起こし
   c. Claude APIで議事録整形・要約・アクションアイテム抽出
   d. meeting_transcriptsテーブルに保存
4. 配布処理開始
   a. 参加者情報から配布先決定
   b. メール配信（優先）→ ワークフローAPI連携 → Slack配布（オプション）
   c. distribution_logsテーブルに記録
5. ジョブ完了処理

```

### 4.2 エラーハンドリング

- 各段階での失敗時の再試行機能
- 失敗理由の詳細ログ記録
- 管理画面での失敗ジョブの手動再実行機能

### 5. 実装すべきファイル構成

```
ai-agent-service/
├── backend/                    # Express.js API Server
│   ├── routes/
│   │   ├── auth.js            # 認証API
│   │   ├── webhooks.js        # Zoom webhook受信
│   │   ├── agent.js           # エージェント関連API
│   │   └── transcripts.js     # 議事録関連API
│   ├── middleware/
│   │   └── auth.js            # JWT認証ミドルウェア
│   ├── services/
│   │   ├── zoomService.js     # Zoom API連携
│   │   ├── transcriptService.js # 議事録生成処理
│   │   ├── distributionService.js # 配布処理
│   │   ├── emailService.js    # メール配信（優先度1）
│   │   ├── workflowApiService.js # ワークフローAPI連携（優先度2）
│   │   ├── slackService.js    # Slack連携（優先度3）
│   │   └── queueService.js    # キュー管理
│   ├── workers/
│   │   └── transcriptWorker.js # バックグラウンド処理
│   ├── models/
│   │   ├── User.js
│   │   ├── AgentJob.js
│   │   ├── MeetingTranscript.js
│   │   └── DistributionLog.js
│   └── utils/
│       ├── aiClient.js        # OpenAI/Anthropic API client
│       └── notificationClient.js # メール・ワークフローAPI・Slack送信統合クライアント

├── frontend/                   # Next.js App Router
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx       # ダッシュボード
│   │   │   └── loading.tsx
│   │   ├── transcripts/
│   │   │   ├── page.tsx       # 議事録一覧
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx   # 議事録詳細
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx
│   │   │   └── loading.tsx
│   │   ├── settings/
│   │   │   └── page.tsx       # 設定画面
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   ├── layout.tsx         # ルートレイアウト
│   │   └── page.tsx           # ホーム
│   ├── components/
│   │   ├── ui/                # shadcn/ui コンポーネント
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── dashboard/
│   │   │   ├── JobsTable.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   └── RealtimeStatus.tsx
│   │   ├── transcripts/
│   │   │   ├── TranscriptList.tsx
│   │   │   ├── TranscriptDetail.tsx
│   │   │   └── EditForm.tsx
│   │   ├── settings/
│   │   │   └── SettingsForm.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── auth.ts            # NextAuth.js設定
│   │   ├── api.ts             # API client
│   │   ├── validations.ts     # Zod schemas
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTranscripts.ts
│   │   └── useJobs.ts
│   └── types/
│       └── index.ts           # TypeScript型定義

```

### 6. 環境変数設定

### 開発環境 (.env.development)

```bash
# Database
DATABASE_URL=postgresql://postgres:password@db:5432/ai_agent_dev

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev_nextauth_secret_12345

# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Zoom API
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
ZOOM_WEBHOOK_SECRET=your_webhook_secret

# Email (優先度1)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password

# Workflow API (優先度2)
WORKFLOW_API_BASE_URL=http://localhost:3000/api
WORKFLOW_API_TOKEN=your_internal_api_token

# Slack (優先度3)
SLACK_BOT_TOKEN=your_slack_bot_token

# Redis (for Bull Queue)
REDIS_URL=redis://redis:6379

# Express API Server
BACKEND_API_URL=http://localhost:8000
JWT_SECRET=dev_jwt_secret_12345

```

### 本番環境 (.env.production)

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/ai_agent_production

# NextAuth.js
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=production_nextauth_secret

# 本番用の各種API キー...

```

### 7. 初期実装での最小機能

1. **Next.js認証システム（NextAuth.js）**
2. **Zoom Webhook受信機能**
3. **簡単な文字起こし → Claude APIで議事録生成**
4. **メール配信機能** (最優先)
5. **管理画面での実行状況確認（Server Components使用）**

### 8. 将来拡張予定機能

- Microsoft Teams連携
- Google Meet連携
- カレンダー連携での自動スケジューリング
- 議事録のPDF出力機能
- 音声品質による自動品質判定
- 参加者の発言時間分析

### 9. セキュリティ要件

- Next.js + NextAuth.jsによる認証・セッション管理
- Zoom Webhook署名検証の実装
- API認証トークン（JWT）の安全な管理
- 議事録データの暗号化保存検討
- ロールベースアクセス制御（管理者・一般ユーザー）
- CORS設定の適切な設定
- CSRFプロテクション

### 11. 開発環境構築

### Docker Compose構成

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15
    container_name: ai-agent-db
    environment:
      POSTGRES_DB: ai_agent_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d

  # Redis for Bull Queue
  redis:
    image: redis:7-alpine
    container_name: ai-agent-redis
    ports:
      - "6379:6379"

  # Backend API Server
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: ai-agent-backend
    env_file:
      - .env.development
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - db
      - redis
    command: npm run dev

  # Frontend Next.js
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: ai-agent-frontend
    env_file:
      - .env.development
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    command: npm run dev

volumes:
  postgres_data:

```

### Backend Dockerfile.dev

```
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]

```

### Frontend Dockerfile.dev

```
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

```

### 12. 本番環境構成（PM2）

### Backend ecosystem.config.js

```jsx
module.exports = {
	apps: [{
		name: 'ai-agent-backend',
		script: './dist/server.js',
		instances: 'max',
		exec_mode: 'cluster',
		env_file: '.env.production',
		log_file: './logs/app.log',
		out_file: './logs/out.log',
		error_file: './logs/error.log',
		log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
		max_memory_restart: '1G',
		restart_delay: 4000,
		watch: false,
		ignore_watch: ['node_modules', 'logs'],
		env: {
			NODE_ENV: 'production',
			PORT: 8000
		}
	}, {
		name: 'ai-agent-worker',
		script: './dist/workers/transcriptWorker.js',
		instances: 2,
		exec_mode: 'fork',
		env_file: '.env.production',
		env: {
			NODE_ENV: 'production'
		}
	}]
}

```

### Frontend ecosystem.config.js

```jsx
module.exports = {
	apps: [{
		name: 'ai-agent-frontend',
		script: 'node_modules/next/dist/bin/next',
		args: 'start',
		cwd: './',
		instances: 'max',
		exec_mode: 'cluster',
		env_file: '.env.production',
		env: {
			NODE_ENV: 'production',
			PORT: 3000
		}
	}]
}

```

### 13. コーディング規約

### インデント設定

- **使用**: タブ文字
- **表示幅**: 1タブ = 4スペース相当
- **適用**: JavaScript, TypeScript, JSON, YAML, CSS全て
- 外部キー関係はすべてUUID使用

### VSCode設定 (.vscode/settings.json)

```json
{
	"editor.insertSpaces": false,
	"editor.tabSize": 4,
	"editor.detectIndentation": false,
	"[javascript]": {
		"editor.insertSpaces": false,
		"editor.tabSize": 4
	},
	"[typescript]": {
		"editor.insertSpaces": false,
		"editor.tabSize": 4
	},
	"[json]": {
		"editor.insertSpaces": false,
		"editor.tabSize": 4
	}
}

```

### ESLint設定 (.eslintrc.js)

```jsx
module.exports = {
	rules: {
		"indent": ["error", "tab"],
		"no-mixed-spaces-and-tabs": "error"
	}
}

```

### Prettier設定 (.prettierrc)

```json
{
	"useTabs": true,
	"tabWidth": 4,
	"semi": true,
	"singleQuote": true,
	"trailingComma": "es5"
}

```

## 実装優先順位

1. **フェーズ1**: Next.js認証システム + Zoom Webhook受信 + 基本的な議事録生成
2. **フェーズ2**: メール配信機能 + Server Components使用した管理画面
3. **フェーズ3**: ワークフローAPI連携 + Server Actions使用した高度な編集機能
4. **フェーズ4**: Slack連携（オプション） + リアルタイム更新 + 詳細な分析機能