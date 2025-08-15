# コードベース構造

## 全体構成
```
ai-agent-service-dir/
├── backend/           # Express.js API サーバー
├── frontend/          # React + Vite フロントエンド
├── scripts/           # 開発・デプロイスクリプト
├── deploy/           # デプロイ設定
├── books/            # ドキュメント・作業ログ
├── docker-compose.yml # 開発環境構成
├── CLAUDE.md         # Claude Code指示書
└── .env.example      # 環境変数テンプレート
```

## Backend 構造 (Express.js)
```
backend/
├── server.js                 # メインサーバー
├── package.json              # 依存関係・NPMスクリプト
├── jest.config.js           # テスト設定
├── routes/                  # API エンドポイント
│   ├── auth.js             # 認証 (/api/auth)
│   ├── agent.js            # ジョブ管理 (/api/agent)
│   ├── transcript.js       # 議事録 (/api/transcripts)
│   ├── upload.js           # ファイルアップロード
│   ├── debug.js            # デバッグ機能
│   └── webhook.js          # Zoom Webhook
├── services/               # ビジネスロジック
│   ├── openaiService.js    # OpenAI API連携
│   ├── claudeService.js    # Anthropic Claude API
│   ├── emailService.js     # メール配信
│   └── zoomService.js      # Zoom API連携
├── workers/               # Background Jobs
│   ├── transcriptWorker.js # 文字起こし処理
│   └── emailWorker.js     # メール配信処理
├── middleware/           # Express ミドルウェア
│   ├── auth.js          # JWT認証
│   ├── validation.js    # 入力値検証
│   └── tenant.js        # テナント管理
├── models/              # データモデル
├── utils/               # ユーティリティ
├── migrations/          # データベースマイグレーション
├── tests/              # テストファイル (86個のテスト)
│   ├── vtt-quality.test.js           # VTT解析品質 (6)
│   ├── transcript-quality.test.js    # 議事録生成品質 (5)
│   ├── email-distribution.test.js    # メール配布品質 (4)
│   ├── database-integrity.test.js    # DB整合性 (7)
│   ├── webhook-processing.test.js    # Webhook処理 (6)
│   ├── meeting-info-display.test.js  # 会議情報表示 (18)
│   ├── vtt-participant-extraction.test.js # 参加者抽出 (9)
│   ├── email-content-regression.test.js   # 表示回帰防止 (11)
│   ├── tenant-admin-auth.test.js     # テナント管理者認証 (8)
│   ├── tenant-admin-access.test.js   # アクセス制御 (7)
│   └── tenant-data-isolation.test.js # データ分離 (5)
└── uploads/            # アップロードファイル保存
```

## Frontend 構造 (React + TypeScript)
```
frontend/
├── package.json              # 依存関係・NPMスクリプト
├── vite.config.ts           # Vite設定
├── tsconfig.json            # TypeScript設定 (分割構成)
├── tsconfig.app.json        # アプリケーション用TypeScript設定
├── tailwind.config.js       # Tailwind CSS設定
├── eslint.config.js         # ESLint設定
├── src/
│   ├── App.tsx              # メインアプリケーション
│   ├── main.tsx             # エントリーポイント
│   ├── components/          # 再利用コンポーネント
│   │   ├── ui/             # 汎用UIコンポーネント
│   │   │   ├── Button.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── TenantEditModal.tsx
│   │   ├── TenantCreateModal.tsx
│   │   └── DistributionHistoryModal.tsx
│   ├── pages/              # ページコンポーネント
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── TranscriptsPage.tsx
│   │   ├── JobsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── TenantAdminPage.tsx
│   │   └── [その他各種ページ]
│   ├── contexts/           # React Context
│   │   └── AuthContext.tsx # 認証状態管理
│   ├── hooks/              # カスタムフック
│   ├── lib/                # ユーティリティ・API
│   │   └── api.ts          # API クライアント
│   ├── types/              # TypeScript型定義
│   │   └── tenant.ts       # テナント関連型
│   ├── router/             # ルーティング
│   │   └── AppRouter.tsx   # React Router設定
│   └── styles/             # CSS・スタイル
│       ├── features.css
│       └── landing.css
└── public/                 # 静的ファイル
```

## Scripts ディレクトリ
```
scripts/
├── dev-frontend-reset.sh        # フロントエンド強制リセット
├── generate-webhook-curl.js     # Webhook テスト用
├── send-webhook.js              # Webhook 送信テスト
├── generate-zoom-webhook.js     # Zoom Webhook生成
├── security-test.sh             # セキュリティテスト
└── env-setup.sh                 # 環境セットアップ
```

## 主要設定ファイル

### Docker構成
- `docker-compose.yml`: 開発環境の全サービス定義
  - PostgreSQL 15 (ポート5432)
  - Redis 7 (ポート6379)  
  - MailHog (ポート8025)
  - Backend (ポート8000)
  - Frontend (ポート3000)

### 環境設定
- `.env.example`: 環境変数テンプレート
- `.env.development`: 開発環境設定（Git除外）
- `.env.production.example`: 本番環境テンプレート

## データベース設計

### 主要テーブル
- `users` - ユーザー管理
- `agent_jobs` - 処理ジョブ管理
- `meeting_transcripts` - 議事録データ
- `distribution_logs` - 配布履歴
- `agent_settings` - エージェント設定
- `zoom_tenant_settings` - テナント別Zoom設定

### 特徴
- 正規化設計（第3正規形）
- JSONBカラムで柔軟メタデータ
- 全テーブルインデックス最適化
- 可逆暗号化はbytea型 + pgcrypto

## API エンドポイント構造

### RESTful設計
- `/api/auth/*` - JWT認証 (register, login, refresh)
- `/api/agent/*` - ジョブ管理 (jobs, stats, settings)  
- `/api/transcripts/*` - 議事録CRUD
- `/api/webhooks/zoom/:tenantId` - Zoom Webhook受信

### AI処理フロー
1. Zoom Webhook受信 → 2. agent_jobs登録 → 3. Bull Queue処理 
→ 4. Whisper文字起こし → 5. Claude議事録生成 → 6. 配布処理