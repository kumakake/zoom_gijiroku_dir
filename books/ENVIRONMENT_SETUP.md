# 環境変数管理 - ベストプラクティス

## 概要

AIエージェントサービスの環境変数管理について、セキュリティ・保守性・チーム開発を考慮したベストプラクティスを説明します。

## 基本方針

### 1. 階層型管理アプローチ

```
環境変数の優先度（高い順）:
1. システム環境変数 (process.env)
2. .env.local (個人開発用)
3. .env.{NODE_ENV} (環境別)
4. .env.example (テンプレート)
5. docker-compose.yml
6. PM2 ecosystem設定
```

### 2. ファイル構成

```
project/
├── .env.example              # Git管理対象（テンプレート）
├── .env.local               # Git除外（個人設定）
├── .env.development         # Git除外（開発環境）
├── .env.staging             # Git除外（ステージング）
├── .env.production          # Git除外（本番環境）
├── docker-compose.yml       # 開発Docker設定
├── docker-compose.prod.yml  # 本番Docker設定
└── deploy/
    ├── ecosystem.example.js # Git管理対象（テンプレート）
    ├── ecosystem.dev.js     # Git除外（開発PM2）
    ├── ecosystem.staging.js # Git除外（ステージングPM2）
    └── ecosystem.prod.js    # Git除外（本番PM2）
```

## セキュリティレベル分類

### レベル1: 公開可能（Git管理可）
- `NODE_ENV`, `PORT`, `LOG_LEVEL`
- サービス設定の初期値
- テンプレートファイル

### レベル2: 開発チーム共有（Git除外）
- 開発環境のダミーAPIキー
- ローカルデータベース設定
- 開発用SMTP設定

### レベル3: 機密情報（外部管理）
- 本番APIキー・パスワード
- 暗号化キー・JWT秘密鍵
- 本番データベース接続情報

## セットアップ手順

### 1. 初回セットアップ

```bash
# セットアップスクリプトを実行
./scripts/env-setup.sh dev

# 環境変数ファイルを編集
vim .env.development

# 必要な値を設定
```

### 2. 開発環境での運用

```bash
# Docker環境での開発
docker-compose up -d

# ローカルでの開発（.env.localを使用）
cp .env.example .env.local
vim .env.local  # 個人設定を追加
npm run dev
```

### 3. 本番環境での運用

```bash
# 本番環境セットアップ
./scripts/env-setup.sh prod

# PM2設定を編集
vim deploy/ecosystem.prod.js

# 外部シークレット管理サービスとの連携
# AWS Secrets Manager / HashiCorp Vault 等
```

## 環境別設定例

### 開発環境 (.env.development)

```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_agent_dev
OPENAI_API_KEY=sk-dev-your-sandbox-key
SMTP_HOST=mailhog
SMTP_PORT=1025
NEXTAUTH_SECRET=dev_secret_32_chars_minimum_length
```

### ステージング環境 (.env.staging)

```bash
NODE_ENV=staging  
DATABASE_URL=postgresql://user:pass@staging-db:5432/ai_agent_staging
OPENAI_API_KEY=sk-your-staging-key
SMTP_HOST=smtp.staging.com
NEXTAUTH_SECRET=staging_secret_32_chars_random_generated
```

### 本番環境 (.env.production)

```bash
NODE_ENV=production

# サブパス設定（重要）
BASE_PATH=/zm
ASSET_PREFIX=/zm
PUBLIC_URL=https://tools.cross-astem.jp/zm

# URL設定
NEXTAUTH_URL=https://tools.cross-astem.jp/zm
BACKEND_API_URL=https://tools.cross-astem.jp/zm/api

# 外部シークレット管理から取得
DATABASE_URL=${DATABASE_URL}
OPENAI_API_KEY=${OPENAI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
JWT_SECRET=${JWT_SECRET}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# Zoom本番設定
ZOOM_API_KEY=${ZOOM_API_KEY}
ZOOM_WEBHOOK_SECRET=${ZOOM_WEBHOOK_SECRET}
ZOOM_WEBHOOK_URL=https://tools.cross-astem.jp/zm/api/webhooks/zoom

# セキュリティ
CORS_ORIGINS=https://tools.cross-astem.jp
```

## セキュリティガイドライン

### 1. 秘密鍵の生成

```bash
# 32文字以上のランダム文字列生成
openssl rand -base64 32

# または
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. .gitignoreの重要性

```gitignore
# 機密情報を含むファイル
.env
.env.local
.env.development
.env.staging
.env.production
.env.*.local

# 本番環境設定
ecosystem.prod.js
ecosystem.staging.js
```

### 3. 環境変数の検証

```javascript
// バックエンドでの必須環境変数チェック
const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY'
];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        console.error(`必須環境変数が未設定です: ${envVar}`);
        process.exit(1);
    }
});
```

## チーム開発での運用

### 1. 新メンバーのオンボーディング

```bash
# 1. リポジトリクローン
git clone <repository-url>

# 2. 環境セットアップ
cd ai-agent-service
./scripts/env-setup.sh dev

# 3. 設定値の確認・編集
vim .env.development

# 4. 開発環境起動
docker-compose up -d
```

### 2. 設定変更時の手順

```bash
# 1. .env.exampleを更新（新しい環境変数追加時）
vim .env.example

# 2. チームに変更を通知
git add .env.example
git commit -m "feat: Add SLACK_BOT_TOKEN environment variable"

# 3. 各環境の設定ファイルを個別更新
# （.env.development, .env.staging, .env.production）
```

### 3. 本番デプロイ時

```bash
# 1. 本番環境設定
./scripts/env-setup.sh prod

# 2. サブパス設定の確認
export BASE_PATH=/zm
export ASSET_PREFIX=/zm
export PUBLIC_URL=https://tools.cross-astem.jp/zm

# 3. Next.jsビルド（サブパス対応）
cd frontend
npm run build

# 4. PM2デプロイ実行
pm2 deploy ecosystem.prod.js production

# 5. Nginx設定適用
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ai-agent
sudo ln -s /etc/nginx/sites-available/ai-agent /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 外部シークレット管理サービス連携

### AWS Secrets Manager

```javascript
// secrets.js
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function loadSecrets() {
    const secretValue = await secretsManager.getSecretValue({
        SecretId: 'prod/ai-agent/env'
    }).promise();
    
    const secrets = JSON.parse(secretValue.SecretString);
    
    // 環境変数に設定
    Object.keys(secrets).forEach(key => {
        process.env[key] = secrets[key];
    });
}

module.exports = { loadSecrets };
```

### HashiCorp Vault

```javascript
// vault.js
const vault = require('node-vault')({
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ENDPOINT,
    token: process.env.VAULT_TOKEN
});

async function loadVaultSecrets() {
    const result = await vault.read('secret/data/ai-agent/prod');
    const secrets = result.data.data;
    
    Object.keys(secrets).forEach(key => {
        process.env[key] = secrets[key];
    });
}

module.exports = { loadVaultSecrets };
```

## トラブルシューティング

### よくある問題

1. **環境変数が読み込まれない**
   ```bash
   # 設定ファイルの存在確認
   ls -la .env*
   
   # 環境変数の値確認
   echo $NODE_ENV
   printenv | grep AI_AGENT
   ```

2. **Docker環境で環境変数が反映されない**
   ```bash
   # docker-compose.ymlのenv_file設定確認
   # コンテナ内での環境変数確認
   docker-compose exec backend printenv
   ```

3. **PM2で環境変数が設定されない**
   ```bash
   # PM2の環境変数確認
   pm2 show ai-agent-backend
   
   # 設定リロード
   pm2 reload ecosystem.prod.js --env production
   ```

### デバッグコマンド

```bash
# 環境変数セットアップ状況確認
./scripts/env-setup.sh dev

# 設定ファイル検証
npm run env:validate  # package.jsonにスクリプト追加要

# ログ確認
tail -f logs/app.log
pm2 logs ai-agent-backend
```

## ベストプラクティス まとめ

### ✅ 推奨事項

1. **テンプレートファイル**を必ずGit管理対象に含める
2. **実際の設定ファイル**は必ずGit除外する
3. **32文字以上**のランダム秘密鍵を使用する
4. **環境別**に設定ファイルを分離する
5. **本番環境**では外部シークレット管理を使用する
6. **セットアップスクリプト**で初期設定を自動化する
7. **必須環境変数**のチェック機能を実装する

### ❌ 避けるべき事項

1. 機密情報をGitにコミットしない
2. 開発環境の設定をそのまま本番環境で使用しない
3. 弱い秘密鍵（短い・推測しやすい）を使用しない
4. 環境変数の検証なしにアプリケーションを起動しない
5. チーム内で機密情報をSlack・メール等で共有しない

この管理方式により、セキュリティを保ちながら効率的なチーム開発と安全な本番運用が可能になります。