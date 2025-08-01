# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要な指示
**すべてのメッセージは日本語で回答してください。**

## プロジェクト概要

AIエージェントサービス - Zoom議事録自動配布システム。Zoom会議終了後に議事録を自動生成・配布するマイクロサービス型フルスタックアプリケーション。

## アーキテクチャ

### マイクロサービス構成
- **Backend**: Express.js RESTful API (`backend/`)
- **Frontend**: Next.js 14 App Router (`frontend/`)
- **Database**: PostgreSQL 15 + Redis 7
- **AI Integration**: OpenAI Whisper + Anthropic Claude API
- **Queue System**: Bull Queue (Redis) によるバックグラウンド処理

### 認証システム
JWT + NextAuth.js ハイブリッド認証。バックエンドはJWT、フロントエンドはNextAuth.js。ロールベース権限管理 ('admin'/'user')。

#### ローカルストレージ利用
**目的**: 認証状態の永続化とユーザーエクスペリエンス向上
- **`auth_token`**: JWTアクセストークン（24時間有効）
- **`user_info`**: ユーザー情報（ID、名前、メール、権限、作成日）をJSON形式で保存

**利点**:
- ページリロード時の認証状態維持
- サーバーへの不要なリクエスト削減
- API認証ヘッダーの自動設定

**セキュリティ**: パスワード等の機密情報は保存せず、認証エラー時に自動クリーンアップ

### データベース設計
正規化設計: `users`, `agent_jobs`, `meeting_transcripts`, `distribution_logs`, `agent_settings`。JSONBカラムで柔軟メタデータ、全テーブルにインデックス最適化済み。

  「可逆性の暗号化項目はbyteaを使うこと。」

  この指針の意味：
  - 可逆性: 暗号化後に元の値に復号化できる必要がある項目
  - bytea型: PostgreSQLのバイナリデータ型を使用
  - pgcrypto: PostgreSQLの組み込み暗号化機能を活用

  適用すべき項目：
  - パスワード以外の機密情報（API Secret、Webhook Secret等）
  - 暗号化して保存し、アプリケーションで復号化して使用する値

  適用しない項目：
  - パスワード（ハッシュ化のみ、可逆性不要）
  - 平文で問題ない項目（Client ID、Account ID等）

  実装方針：
  - データベーススキーマ: bytea型カラム
  - 暗号化: pgp_sym_encrypt(value, key)
  - 復号化: pgp_sym_decrypt(encrypted_value, key)
  - SQL内で暗号化・復号化を実行

  この指針により、Node.js側の暗号化ライブラリの問題を回避し、PostgreSQLの安定した暗号化機能を活用できます。

  今後、類似の機密情報を扱う際は、この方針に従って実装します。

## 開発コマンド

### プロジェクト起動
```bash
# 全サービス起動
docker compose up -d

# ログ確認（リアルタイム）
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# リビルド
docker compose up -d --build

# 環境リセット
docker compose down -v && docker compose up -d --build
```

### ローカル開発
```bash
# バックエンド
cd backend && npm run dev

# フロントエンド
cd frontend && npm run dev

# 型チェック（フロントエンド）
cd frontend && npm run type-check

# リント
npm run lint
```

### フロントエンド変更反映問題の解決
**問題**: フロントエンドの変更が即座に反映されない  
**原因**: Docker + Vite + ホットリロードの組み合わせでの既知の問題

#### 標準解決手順
```bash
# 1. 変更確認
docker compose exec frontend grep "変更内容" /app/src/ファイル名

# 2. 通常の再起動
docker compose restart frontend

# 3. 強制リセット（変更が反映されない場合）
./scripts/dev-frontend-reset.sh
```

#### ブラウザ側の対応
1. 開発者ツール（F12）を開く
2. Networkタブで「Disable cache」にチェック
3. 強制リロード（Ctrl+F5 / Cmd+Shift+R）
4. 問題が続く場合はシークレットモードでテスト

### データベース操作
```bash
# PostgreSQL接続
docker compose exec db psql -U postgres -d ai_agent_dev

# 重要なクエリ
SELECT id, email, name, role FROM users;
SELECT type, status, created_at FROM agent_jobs ORDER BY created_at DESC;
```

### テスト・デバッグ
```bash
# バックエンドテスト（全テスト実行）
cd backend && npm test

# 品質テスト（VTT解析・議事録生成品質）
cd backend && npm run test:quality

# デグレード防止テスト（メール配布・DB整合性・Webhook処理）
cd backend && npm run test:degradation

# メール表示問題専用テスト（所要時間・参加者情報）
cd backend && npm run test:meeting-info-only

# テナント管理者機能テスト（テナント権限・データ分離品質）
cd backend && npm run test:tenant-admin

# 統合テストスクリプト（全テスト + 手動検証）
cd backend && npm run test:meeting-info

# テスト監視（ファイル変更時自動実行）
cd backend && npm run test:watch

# カバレッジ付きテスト
cd backend && npm run test:coverage

# CI用テスト（カバレッジ + watchAll無効）
cd backend && npm run test:ci

# APIヘルスチェック
curl http://localhost:8000/health

# フロントエンド型チェック
cd frontend && npm run type-check
```

#### テストファイル対応表

| npm script | 対象テストファイル | テスト内容 | テスト数 |
|------------|-------------------|------------|----------|
| `npm test` | `tests/*.test.js` | 全テスト実行 | 86個 |
| `npm run test:quality` | `tests/vtt-quality.test.js`<br>`tests/transcript-quality.test.js` | VTT解析品質(6)<br>議事録生成品質(5) | 11個 |
| `npm run test:degradation` | `tests/email-distribution.test.js`<br>`tests/database-integrity.test.js`<br>`tests/webhook-processing.test.js` | メール配布品質(4)<br>DB整合性(7)<br>Webhook処理品質(6) | 17個 |
| `npm run test:meeting-info-only` | `tests/meeting-info-display.test.js`<br>`tests/vtt-participant-extraction.test.js`<br>`tests/email-content-regression.test.js` | 会議情報表示(18)<br>VTT参加者抽出(9)<br>メール表示回帰防止(11) | 38個 |
| `npm run test:tenant-admin` | `tests/tenant-admin-auth.test.js`<br>`tests/tenant-admin-access.test.js`<br>`tests/tenant-data-isolation.test.js` | テナント管理者認証(8)<br>アクセス制御(7)<br>データ分離(5) | 20個 |
| `npm run test:meeting-info` | `test-meeting-info-fix.js` | 統合テスト + 手動検証 | - |

#### 主要テストファイルの詳細

**品質保証テスト（従来28個）:**
- `vtt-quality.test.js` - VTT解析品質（発言者名抽出、品質スコア）
- `transcript-quality.test.js` - 議事録生成品質（フォーマット、専門用語保持）
- `email-distribution.test.js` - メール配布品質（履歴記録、送信状態）
- `database-integrity.test.js` - DB整合性（制約、トランザクション）
- `webhook-processing.test.js` - Webhook処理品質（署名検証、ペイロード）

**メール表示問題対応テスト（追加38個）:**
- `meeting-info-display.test.js` - 基本機能（extractMeetingInfo、EmailService表示）
- `vtt-participant-extraction.test.js` - VTT統合（参加者補完、所要時間計算）
- `email-content-regression.test.js` - デグレード防止（「不明」表示問題回帰防止）

**テナント管理者機能テスト（追加20個）:**
- `tenant-admin-auth.test.js` - テナント管理者認証（JWT、ロール確認、アクセストークン）
- `tenant-admin-access.test.js` - アクセス制御（自テナントのみ、権限チェック、他テナント拒否）
- `tenant-data-isolation.test.js` - データ分離（クエリ制限、テナント別データ、セキュリティ）

**統合テストスクリプト:**
- `test-meeting-info-fix.js` - 全テスト実行 + 手動検証 + 結果レポート

## 重要な技術仕様

### API構造
**RESTful設計**:
- `/api/auth/*` - JWT認証 (register, login, refresh)
- `/api/agent/*` - ジョブ管理 (jobs, stats, settings)
- `/api/transcripts/*` - 議事録CRUD
- `/api/webhooks/zoom` - Zoom Webhook受信

**認証フロー**: Credentials Provider → JWT生成 → NextAuth session管理 → API Request Authorization header

### AI処理フロー
1. Zoom Webhook (HMAC-SHA256署名検証) → 2. agent_jobs登録 → 3. Bull Queue処理 → 4. Whisper文字起こし → 5. Claude議事録生成 → 6. 配布処理 → 7. distribution_logs記録

### フロントエンド構成
**Next.js App Router**:
- `app/(auth)/` - 認証グループルート
- `app/dashboard/` - メインダッシュボード  
- `app/transcripts/[id]/` - 動的議事録詳細
- **状態管理**: React Query (サーバー状態) + React Hook Form (フォーム)
- **UI**: Tailwind CSS + Headless UI + Lucide React

### 環境設定
`.env.development`で開発環境設定。本番では`PM2 + ecosystem.config.js`。重要な環境変数:
- `DATABASE_URL`, `REDIS_URL`
- `NEXTAUTH_SECRET`, `JWT_SECRET` 
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `ZOOM_API_KEY`, `ZOOM_WEBHOOK_SECRET`

#### 本番環境管理
**PM2による本番環境管理**: `ecosystem.config.js`で全環境変数を一元管理。開発環境（Docker）と本番環境（PM2）で異なる設定を適切に分離。

**重要な設定例**:
- `REDIS_URL`: 本番では`redis://default:password@localhost:6379`形式
- `NODE_ENV`: `production`で本番モード
- インスタンス設定: `instances: 'max'`, `exec_mode: 'cluster'`

## コーディング規約

### インデント
**タブ文字使用** (1タブ=4スペース相当)。`.vscode/settings.json`で強制設定済み。
yamlファイルはタブがNGのため、２スペースで設定する。

### TypeScript
完全型安全。`types/index.ts`に全型定義。フロントエンドは`strict: true`、バックエンドはJavaScript。

### セキュリティ
- bcryptjs (saltRounds: 12) パスワードハッシュ
- Helmet + CORS + Rate Limiting
- express-validator入力検証
- Zoom署名検証必須

## アクセス情報

### ローカル環境
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Database**: localhost:5432 (postgres/password)

### デフォルトログイン
- **Email**: admin@example.com
- **Password**: TestPassword123

## トラブルシューティング

### 一般的な問題
- **ポート競合**: `lsof -i :3000` で確認
- **DB接続エラー**: `docker compose restart db`
- **Redis接続エラー**: `docker compose restart redis`
- **型エラー**: `npm run type-check`で確認

### デバッグ手順
1. `docker compose ps`でサービス状況確認
2. `docker compose logs service_name`でログ確認
3. データベース接続テスト: `SELECT 1;`
4. API疎通確認: `/health`エンドポイント

## 拡張開発ガイド

### 新APIエンドポイント追加
1. `backend/routes/`にルートファイル作成
2. `server.js`にルート登録
3. `frontend/lib/api.ts`にクライアント関数追加
4. `types/index.ts`に型定義追加

### 新画面追加
1. `frontend/app/`にページ作成
2. `components/`にコンポーネント作成
3. 認証が必要な場合は`useSession`フック使用
4. API呼び出しは`useQuery`/`useMutation`使用

### データベーススキーマ変更
1. `backend/migrations/`に新SQLファイル作成
2. 既存データとの互換性考慮
3. インデックス最適化
4. 型定義更新 (`types/index.ts`)

## パフォーマンス考慮事項

- **DB**: 接続プール20、ページネーション、インデックス活用
- **Cache**: Redis (セッション) + React Query (API) 
- **Security**: Rate limiting (15分/100req), JWT (24h access + 7d refresh)
- **Logging**: Winston構造化ログ、クエリ実行時間計測

## 重要な注意事項

### Docker Compose コマンド
- **必須**: `docker compose` を使用（`docker-compose` は非推奨）
- **例**: `docker compose up -d`, `docker compose logs -f backend`
- 過去にdocker-composeコマンドで問題が度々発生しているため、常にdocker composeを使用すること

  ## デグレード防止ガイドライン

  ### 重要原則
  **既存の動作仕様を変更する前に、必ず現在の実装を完全に把握し、互換性を保つこと**

  ### 必須確認事項
  1. **既存コード調査の徹底**
     - 新機能追加時は、関連する既存コードを全て確認
     - データベーススキーマ、API仕様、フロントエンド実装の整合性チェック
     - `grep -r "変更対象の名前"` で全ファイル検索を実行

  2. **変更前の現状把握**
     - 既存のパラメータ名、API構造、データベーススキーマを文書化
     - 変更が他のコンポーネントに与える影響を事前に特定
     - 関連テストケースの確認

  3. **段階的な変更実装**
     - 破壊的変更は避け、下位互換性を保つ
     - 新旧両方をサポートする移行期間を設ける
     - 一度に大量の変更をせず、小さな単位で検証

  4. **変更時の必須作業**
     - データベース移行スクリプトの作成
     - API仕様書の更新
     - 関連テストの実行と更新
     - 影響範囲の全コンポーネントでの動作確認

  ### 禁止事項
  - 既存のパラメータ名を確認せずに新しい名前で実装
  - 一部のファイルのみ更新して他を見落とす
  - テストなしでの仕様変更
  - 既存データとの互換性を考慮しない変更

  ### ⚠️ データ保護の最重要原則 ⚠️
  **データは神聖である。軽視してはならない。**

  #### データベース変更時の絶対遵守事項
  1. **カラム削除前の必須確認**
     ```bash
     # 必ず実行すること
     \d table_name              # テーブル構造確認
     SELECT COUNT(*) FROM table; # データ存在確認
     ```

  2. **ユーザー承認の必須化**
     - カラム削除: 「カラム○○を削除します。よろしいですか？」
     - テーブル変更: 「テーブル○○を変更します。影響範囲は△△です。よろしいですか？」
     - 設定データ削除: 「Zoom設定等の重要データを削除します。よろしいですか？」

  3. **段階的変更の強制**
     - 一度に複数カラムを変更しない
     - 1つずつ確認して実行
     - 各段階で動作確認

  4. **過去の重大事例（学習用）**
     - 2025/07/27: durationカラム削除でログイン機能停止
     - 2025/07/27: Zoom設定データ完全削除で会議処理不可
     - 原因: 事前確認なし、ユーザー承認なし、バックアップなし

  #### 絶対に守るべきデータ保護ルール
  - **確認なしでのカラム削除禁止**
  - **重要設定データの無断削除禁止**  
  - **バックアップなしの破壊的変更禁止**
  - **影響範囲不明のまま実行禁止**

  ### エラー回避のチェックリスト
  - [ ] 既存実装の完全な把握
  - [ ] 変更影響範囲の特定
  - [ ] 移行計画の策定
  - [ ] テストケースの準備
  - [ ] 段階的リリース計画

  より効果的な指示方法：

  1. 具体的なタスク指示

  ❌ 悪い例: "Zoom設定を更新して"
  ✅ 良い例: "現在のZoom設定パラメータを調査し、既存のAPI Key/Secret方式をClient ID/Secret方式に移行。下位互換性を保ちつつ段階的に実装"

  2. 制約条件の明示

  - "既存データベースの互換性を保つこと"
  - "既存APIエンドポイントは変更しないこと"
  - "フロントエンドの既存機能は全て動作し続けること"

  3. 確認ポイントの指定

  - "変更前後でテストスイートが全て通ることを確認"
  - "既存テナントの設定が正常に表示されることを確認"
  - "新旧両方のパラメータ形式をサポート"

## ⚠️ 重要な開発指針：無駄な作業の防止

### 問題の認識
Claude Codeは頻繁に**無意味で無駄な実装**を提案・実行する傾向がある。
ユーザーが指摘すると簡単に無駄であることを認めるが、事前に防げていない。

**モデル特性による違い（実体験より）:**
- **Claude Opus**: まず考えて根掘り葉掘り質問 → 要件明確化 → 実装
- **Claude Sonnet 4/3.5**: とりあえず動くものを作る → 後から問題発覚 → 無駄な作業

**Sonnet系の問題行動パターン:**
1. すぐに実装に飛びつく
2. 動くものを優先する
3. 実用性を軽視する
4. ユーザー指摘後に「確かに無意味」と認める

### 過去の無駄な作業例
- スコープテストで会議ID未入力時の「偽の成功表示」実装
- 実用性のない機能の作成
- 後から「意味がない」と判明する作業

### 必須の事前確認ルール
**実装前に必ず以下を確認すること：**

1. **実用性の確認**
   - 「この機能は本当に必要ですか？」
   - 「ユーザーにとって意味がありますか？」
   - 「実際の業務で使われますか？」

2. **偽装の禁止**
   - 「偽の成功表示」は絶対に作らない
   - 「とりあえず動く」だけの無意味な実装を避ける
   - 実際のテストや検証を伴わない機能は作らない

3. **目的の明確化**
   - なぜその機能が必要なのかを明文化
   - どのような問題を解決するのかを説明
   - 代替手段がないかを検討

### 実装判断のチェックリスト
- [ ] この機能の具体的な利用シーンが明確か？
- [ ] 「偽の表示」「見せかけの動作」になっていないか？
- [ ] ユーザーが実際に価値を感じる機能か？
- [ ] 時間をかける価値がある実装か？
- [ ] より簡単で効果的な解決方法はないか？

### 禁止事項
❌ **やってはいけないこと：**
- とりあえず動かすための偽装実装
- 意味のない成功メッセージの表示
- 実際のテストを行わない機能
- ユーザーを欺く表示や動作

✅ **すべきこと：**
- 実用性を最優先に考える
- 正直で透明性のある実装
- ユーザーの時間を尊重する
- 事前の十分な検討

