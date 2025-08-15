# 開発コマンド一覧

## プロジェクト起動・管理

### 全体サービス起動
```bash
# 全サービス起動
docker compose up -d

# リビルドして起動
docker compose up -d --build

# 環境完全リセット
docker compose down -v && docker compose up -d --build
```

### ログ確認
```bash
# 全サービスのログ（リアルタイム）
docker compose logs -f

# 個別サービスログ
docker compose logs -f backend
docker compose logs -f frontend
```

## ローカル開発

### Backend開発
```bash
cd backend
npm run dev          # nodemon開発サーバー
npm start            # 本番モード起動
npm run build        # ビルド
```

### Frontend開発
```bash
cd frontend
npm run dev          # Vite開発サーバー
npm run build        # TypeScript + Vite ビルド
npm run preview      # ビルド結果のプレビュー
```

## テスト実行

### Backend テスト
```bash
cd backend

# 全テスト実行
npm test

# 専用テストスイート
npm run test:quality           # VTT解析・議事録生成品質 (11個)
npm run test:degradation       # メール・DB・Webhook品質 (17個) 
npm run test:meeting-info-only # 会議情報表示問題対応 (38個)
npm run test:tenant-admin      # テナント管理者機能 (20個)

# その他
npm run test:watch             # ファイル監視モード
npm run test:coverage          # カバレッジ付き
npm run test:ci               # CI用（watch無効）
npm run test:e2e              # E2Eテスト
npm run test:meeting-info     # 統合テスト + 手動検証
```

## 品質管理・Lint

### Frontend
```bash
cd frontend
npm run lint         # ESLint実行
npm run type-check   # TypeScript型チェック（package.jsonにはないがCLAUDE.mdに記載）
```

### Backend
```bash
cd backend
npm run lint         # ESLint実行
```

## データベース操作
```bash
# PostgreSQL直接接続
docker compose exec db psql -U postgres -d ai_agent_dev

# よく使うクエリ
SELECT id, email, name, role FROM users;
SELECT type, status, created_at FROM agent_jobs ORDER BY created_at DESC;
```

## トラブルシューティング

### フロントエンド変更反映問題
```bash
# 1. 変更確認
docker compose exec frontend grep "変更内容" /app/src/ファイル名

# 2. 通常の再起動
docker compose restart frontend

# 3. 強制リセット
./scripts/dev-frontend-reset.sh
```

### 一般的デバッグ
```bash
# サービス状況確認
docker compose ps

# ポート確認
lsof -i :3000
lsof -i :8000

# サービス個別再起動
docker compose restart db
docker compose restart redis
```

## ヘルスチェック・API確認
```bash
# APIヘルスチェック
curl http://localhost:8000/health

# アクセスURL
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000  
# MailHog UI: http://localhost:8025
```

## Darwin (macOS) システムコマンド
```bash
# ファイル検索・操作
find . -name "*.js" -type f
grep -r "検索文字列" .
ls -la
cd path/to/directory

# Git操作
git status
git add .
git commit -m "message"
git push
git pull
```