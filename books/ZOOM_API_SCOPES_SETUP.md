# Zoom API スコープ設定ガイド

## 現在のシステムで使用されているZoom APIエンドポイント

### 1. 録画ファイル一覧取得 (最重要・必須)
**エンドポイント**: `GET /v2/meetings/{meetingId}/recordings`
- **用途**: 会議の録画ファイル一覧取得（音声ファイル、VTTファイル）
- **必要スコープ**: `cloud_recording:read:list_recording_files:admin`
- **重要度**: 🔴 必須（これがないとシステムが動作しない）

### 2. 参加者情報取得 (必須)
**エンドポイント**: `GET /v2/report/meetings/{meetingId}/participants`
- **用途**: 会議参加者のメールアドレス取得（自動配布用）
- **必要スコープ**: `report:read:list_meeting_participants:admin`
- **重要度**: 🔴 必須（これがないと自動配布ができない）

## 推奨スコープ設定

### ✅ 必須スコープ（システム動作に不可欠な2つのみ）
```
cloud_recording:read:list_recording_files:admin
report:read:list_meeting_participants:admin
```

### ❌ 不要なスコープ（削除推奨）
以下のスコープは**システム動作に不要**なため、設定しないことを推奨します：
```
recording:read (存在しないスコープ名)
meeting:read (デバッグ用のみ)
user:read (デバッグ用のみ)
report:read:admin (曖昧なスコープ名)
```

## Zoom App Marketplace での設定手順

### 1. アプリケーション基本情報
- **App Type**: Server-to-Server OAuth
- **App Category**: Business
- **Short Description**: AI-powered meeting minutes generation and distribution system

### 2. 必要なスコープ申請
以下のスコープを選択してください：

#### 📋 必須スコープ（2つのみ設定）

**1. 録画ファイル一覧取得（最重要）**
- ☑️ `cloud_recording:read:list_recording_files:admin` - Returns all of a meeting's recordings.

**2. 参加者情報取得（必須）**  
- ☑️ `report:read:list_meeting_participants:admin` - View meeting participant reports

#### ❌ 設定不要なスコープ（削除推奨）

**Recording関連の不要スコープ:**
- ❌ `cloud_recording:read:recording:admin` - 個別録画表示（不要）
- ❌ `cloud_recording:read:list_user_recordings:admin` - ユーザー録画一覧（不要）
- ❌ `cloud_recording:read:recording_analytics_details:admin` - 分析詳細（不要）
- ❌ `cloud_recording:read:registrant:admin` - 登録情報（不要）
- ❌ その他の `cloud_recording:read:*` スコープ（不要）

**Report関連の不要スコープ:**
- ❌ `report:read:webinar:*` - ウェビナー関連（不要）
- ❌ `report:read:billing:*` - 請求情報（不要）
- ❌ `report:read:user_activities:*` - ユーザー活動（不要）
- ❌ その他の `report:read:*` スコープ（不要）

**その他の不要スコープ:**
- ❌ `meeting:read` - 会議情報（デバッグ用のみ）
- ❌ `user:read` - ユーザー情報（デバッグ用のみ）

### 3. Event Subscriptions設定
- ☑️ `recording.completed` - Recording completed
  - ☑️ All Recordings have completed
  - ☑️ Recording Transcript files have completed
- ☑️ `meeting.ended` - Meeting ended

### 4. Webhook Endpoint設定
- **Development**: `https://your-ngrok-id.ngrok.io/api/webhooks/zoom/{tenantId}`
- **Production**: `https://tools.cross-astem.jp/zm/api/webhooks/zoom/{tenantId}`

## スコープ申請理由書（テンプレート）

### cloud_recording:read:list_recording_files:admin
```
このスコープは、会議終了後に録画ファイル一覧を取得するために必要です。
システムでは録画完了通知を受信後、自動的に録画ファイル一覧を取得し、
音声ファイルやVTT（字幕）ファイルを特定してAI議事録生成処理を開始します。
このスコープがないと、システムの核心機能が動作しません。
```

### report:read:list_meeting_participants:admin
```
会議参加者のメールアドレスと参加情報を取得するために必要です。
生成されたAI議事録を参加者全員に自動配布する機能で使用します。
このスコープがないと、議事録の自動配布ができません。
```

### なぜ2つのスコープのみか？
```
当システムは最小権限の原則に基づき、実際に必要な機能のみに限定しています。
- 録画ファイル取得: AI議事録生成の入力データ
- 参加者情報取得: 議事録の自動配布先
これら2つの機能のみでシステム全体が動作するため、追加のスコープは不要です。
```

## 申請時の注意点

### ⚠️ 管理者権限スコープの申請について
- `recording:read:admin`と`report:read:admin`は管理者権限が必要
- 申請時に「組織全体の録画・レポートへのアクセスが必要な理由」を明記
- マルチテナント対応のため、テナント管理者が他のテナントの録画にアクセスしないことを保証

### ✅ 承認されやすい説明文例
```
Our application provides automated meeting minutes generation service for enterprise customers.
We need admin-level access to recordings and reports to:

1. Access recordings from all user accounts within the organization
2. Retrieve participant email addresses for automatic distribution
3. Support multi-tenant architecture where tenant admins manage their organization's meetings

The application implements strict tenant isolation to ensure data security and privacy.
Each tenant can only access their own organization's data.
```

## セキュリティ考慮事項

### 🔒 データアクセス制限
- 各テナントは自組織の録画のみアクセス可能
- Webhook署名検証による不正アクセス防止
- 暗号化されたデータベースでの認証情報保存

### 🔒 最小権限の原則
- 必要最小限のスコープのみ申請
- 未使用のスコープは将来的に削除を検討
- 定期的な権限見直しの実施

## 実装済み機能との対応

| 機能 | 使用エンドポイント | 必要スコープ | 実装状況 | 重要度 |
|------|-------------------|--------------|----------|---------|
| 録画ファイル一覧取得 | `/v2/meetings/{id}/recordings` | `cloud_recording:read:list_recording_files:admin` | ✅ 実装済み | 🔴 必須 |
| 参加者メール取得 | `/v2/report/meetings/{id}/participants` | `report:read:list_meeting_participants:admin` | ✅ 実装済み | 🔴 必須 |
| VTT解析処理 | ダウンロードURL使用 | (上記に含まれる) | ✅ 実装済み | - |
| 音声文字起こし | ダウンロードURL使用 | (上記に含まれる) | ✅ 実装済み | - |
| AI議事録生成 | OpenAI/Anthropic API | - | ✅ 実装済み | - |
| 議事録自動配布 | EmailService | - | ✅ 実装済み | - |

## トラブルシューティング

### 403 Forbidden エラーが発生する場合
1. **原因**: 申請したスコープが承認されていない
2. **解決**: Zoom App Marketplaceで承認状況を確認
3. **確認方法**: Developer Console > Your App > Scopes

### 録画データが取得できない場合
1. **原因**: `cloud_recording:read:list_recording_files:admin`スコープが不足
2. **解決**: 正確なスコープ名で申請し直す
3. **確認方法**: デバッグダッシュボードでスコープテスト実行

### 参加者情報が取得できない場合
1. **原因**: `report:read:list_meeting_participants:admin`スコープが不足
2. **解決**: 正確なスコープ名で申請し直す
3. **確認方法**: デバッグダッシュボードでスコープテスト実行

### スコープ名が見つからない場合
1. **確認**: Zoom App Marketplaceで以下を検索
   - Recording セクション → `list_recording_files:admin`
   - Report セクション → `list_meeting_participants:admin`
2. **注意**: 古いドキュメントの `recording:read` は存在しません

---

**更新日**: 2025年7月28日  
**対象バージョン**: マルチテナント対応版（簡素化・正確化版）  
**申請優先度**: 高（システム運用に必須）

## 📝 変更履歴

### 2025年7月28日 - 大幅簡素化・正確化
- ✅ 必須スコープを4つから2つに削減（50%削減）
- ✅ 正確なZoom APIスコープ名に修正
- ✅ 不要なスコープを明確に削除推奨
- ✅ 最小権限の原則に基づく設計