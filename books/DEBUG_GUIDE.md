# Zoom連携デバッグガイド

このガイドでは、AIエージェントサービスのZoom連携機能を段階的にデバッグする方法を説明します。

## 目次

1. [デバッグ環境のセットアップ](#1-デバッグ環境のセットアップ)
2. [段階別デバッグ手順](#2-段階別デバッグ手順)
3. [トラブルシューティング](#3-トラブルシューティング)
4. [実際の録画データを使用したテスト](#4-実際の録画データを使用したテスト)

## 1. デバッグ環境のセットアップ

### 前提条件

- Docker Composeが起動済み
- 管理者権限でログイン済み
- 必要な環境変数が設定済み

### 環境変数の確認

`.env.development`ファイルに以下が設定されていることを確認：

```bash
# Zoom API設定（Server-to-Server OAuth）
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
ZOOM_WEBHOOK_SECRET=your_zoom_webhook_secret

# AI API設定
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# メール設定
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
```

### サービス起動

```bash
# プロジェクトディレクトリに移動
cd ai-agent-service

# 全サービス起動
docker-compose up -d

# ログ確認
docker-compose logs -f backend
```

## 2. 段階別デバッグ手順

### アクセス方法

1. ブラウザで http://localhost:3000 にアクセス
2. 管理者アカウントでログイン（admin@example.com / DemoPassword123）
3. ダッシュボードの「デバッグ」ボタンをクリック、または http://localhost:3000/debug に直接アクセス

### ステップ1: 環境変数状態の確認

デバッグページの上部で、すべての環境変数が正しく設定されていることを確認します。

**確認項目:**
- ✅ Zoom API: Account ID, Client ID, Client Secret, Webhook Secret
- ✅ AI API: OpenAI, Anthropic
- ✅ Email: SMTP Host, SMTP User, SMTP Pass
- ✅ 接続: Database, Redis

**問題があった場合:**
- 環境変数を再設定
- Dockerサービスを再起動: `docker-compose restart backend frontend`

### ステップ2: Zoom API認証テスト

**目的:** Zoom APIへの認証が正常に動作することを確認

**手順:**
1. 「2. Zoom API認証テスト」の「テスト実行」をクリック
2. 成功の場合: アクセストークンが取得されます
3. 失敗の場合: エラーメッセージを確認し、認証情報を見直します

**成功例:**
```json
{
  "success": true,
  "message": "Zoom API認証テスト成功",
  "tokenInfo": {
    "token_type": "bearer",
    "expires_in": 3600,
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5..."
  }
}
```

### ステップ3: Webhook受信テスト

**目的:** Zoom Webhookの受信処理が正常に動作することを確認

**手順:**
1. 「1. Zoom Webhook受信テスト」の「テスト実行」をクリック
2. サンプルのWebhookデータでagent_jobsテーブルにレコードが追加されます
3. 成功の場合: ジョブIDが返されます

**成功例:**
```json
{
  "success": true,
  "message": "Webhook受信テスト成功",
  "jobId": 15,
  "data": {
    "event": "recording.completed",
    // ... Webhookデータ
  }
}
```

### ステップ4: 録画データ取得テスト

**目的:** 実際のZoom会議の録画データが取得できることを確認

**前提:** 実際にZoomで録画された会議のMeeting IDが必要

**手順:**
1. Zoom管理画面または会議終了時に取得したMeeting IDを入力
2. 「3. 録画データ取得テスト」の「テスト実行」をクリック
3. 録画ファイルの情報が表示されます

**Meeting IDの取得方法:**
- Zoom管理画面: https://zoom.us/recording
- 会議終了時の通知メール
- Webhook受信時のpayload.object.meeting_id

**成功例:**
```json
{
  "success": true,
  "message": "録画データ取得テスト成功",
  "recordingData": {
    "id": "123456789",
    "topic": "チームミーティング",
    "recording_files": [
      {
        "id": "abc123",
        "file_type": "M4A",
        "file_size": 15728640,
        "download_url": "利用可能"
      }
    ]
  }
}
```

### ステップ5: 文字起こしテスト

**目的:** OpenAI Whisper APIによる音声文字起こしが正常に動作することを確認

**手順:**
1. テスト用音声ファイルのURLを入力（またはローカルファイルパス）
2. 「4. 文字起こしテスト」の「テスト実行」をクリック
3. 文字起こし結果が表示されます

**テスト用音声ファイル例:**
- 公開されているサンプル音声ファイル
- 短い（1-2分）の音声ファイルを推奨
- 対応形式: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM

**成功例:**
```json
{
  "success": true,
  "message": "音声ファイル文字起こしテスト成功",
  "transcription": {
    "text": "こんにちは、今日の会議を始めさせていただきます...",
    "length": 1250,
    "preview": "こんにちは、今日の会議を始めさせていただきます。まず最初に前回の議題について..."
  }
}
```

### ステップ6: 議事録生成テスト

**目的:** Anthropic Claude APIによる議事録生成が正常に動作することを確認

**手順:**
1. 文字起こしテキストを入力（デフォルト値が設定済み）
2. 会議タイトルを入力（省略可）
3. 「5. 議事録生成テスト」の「テスト実行」をクリック
4. 整形された議事録が表示されます

**成功例:**
```json
{
  "success": true,
  "message": "議事録生成テスト成功",
  "transcript": {
    "summary": "本日の会議では、新しいプロジェクトの方向性について議論しました...",
    "actionItems": [
      "来週までにプロトタイプを作成する（担当: 田中）",
      "関係者への進捗報告を行う（担当: 佐藤）"
    ],
    "fullTranscript": "詳細な議事録内容..."
  }
}
```

### ステップ7: メール配信テスト

**目的:** 議事録メールの配信が正常に動作することを確認

**手順:**
1. 送信先メールアドレスを入力
2. 「6. メール配信テスト」の「テスト実行」をクリック
3. メール送信が完了します

**開発環境での確認:**
- MailHog Web UI: http://localhost:8025
- 送信されたメールがここで確認できます

**成功例:**
```json
{
  "success": true,
  "message": "メール配信テスト成功",
  "emailData": {
    "recipient": "test@example.com",
    "meetingTopic": "テスト会議 - メール配信確認",
    "summaryLength": 150,
    "actionItemsCount": 2
  }
}
```

### ステップ8: 統合フローテスト

**目的:** 全体の処理フローが連携して動作することを確認

**手順:**
1. Meeting IDと送信先メールアドレスを入力
2. 「統合テスト実行」をクリック
3. 各ステップの実行結果が表示されます

**注意:** このテストでは実際の音声ファイルダウンロードはスキップされ、サンプルテキストで議事録生成・メール配信が実行されます。

## 3. トラブルシューティング

### よくある問題と解決方法

#### 1. Zoom API認証エラー

**エラー例:**
```json
{
  "success": false,
  "error": "invalid_client"
}
```

**解決方法:**
1. Zoom Marketplace設定を確認
2. Client IDとClient Secretが正しいか確認
3. Account IDが正しいか確認
4. Server-to-Server OAuthアプリが正しく設定されているか確認

#### 2. 録画データ取得エラー

**エラー例:**
```json
{
  "success": false,
  "error": "Meeting not found"
}
```

**解決方法:**
1. Meeting IDが正しいか確認
2. 録画が完了しているか確認
3. アカウントに録画へのアクセス権限があるか確認
4. 必要なScopesが設定されているか確認

#### 3. 文字起こしエラー

**エラー例:**
```json
{
  "success": false,
  "error": "Invalid audio format"
}
```

**解決方法:**
1. 音声ファイル形式を確認（MP3, M4A, WAVなど）
2. ファイルサイズを確認（25MB以下）
3. OpenAI API Keyが正しいか確認
4. ネットワーク接続を確認

#### 4. 議事録生成エラー

**エラー例:**
```json
{
  "success": false,
  "error": "API quota exceeded"
}
```

**解決方法:**
1. Anthropic API Keyが正しいか確認
2. API利用制限を確認
3. 文字起こしテキストが長すぎないか確認

#### 5. メール配信エラー

**エラー例:**
```json
{
  "success": false,
  "error": "SMTP connection failed"
}
```

**解決方法:**
1. SMTP設定を確認
2. MailHogサービスが起動しているか確認: `docker-compose ps`
3. ネットワーク設定を確認

### ログ確認方法

```bash
# バックエンドログ
docker-compose logs -f backend

# 特定のサービスログ
docker-compose logs -f mailhog
docker-compose logs -f db
docker-compose logs -f redis

# すべてのログ
docker-compose logs -f
```

## 4. 実際の録画データを使用したテスト

### 準備

1. **Zoom会議の実施**
   - 短い（2-3分）テスト会議を開催
   - クラウド録画を有効にする
   - 会議終了後、録画が完了するまで待機

2. **Webhook設定**
   - ngrokまたは本番環境でWebhook URLを設定
   - `recording.completed`イベントを有効化

3. **録画完了の確認**
   - Zoom管理画面で録画ステータスを確認
   - Webhook受信ログを確認

### テスト実行

1. **リアルタイムテスト**
   - 実際にZoom会議を行い、Webhook受信を確認
   - agent_jobsテーブルにレコードが自動追加されることを確認

2. **手動フローテスト**
   - デバッグページで実際のMeeting IDを使用
   - 統合フローテストを実行

3. **エンドツーエンドテスト**
   - 会議開始→録画→Webhook受信→処理→メール配信の全フローを確認

### 成功基準

- ✅ Webhook受信でagent_jobが作成される
- ✅ 録画データが正常に取得できる
- ✅ 音声ファイルが文字起こしされる
- ✅ 議事録が生成される
- ✅ メールが配信される
- ✅ distribution_logsに配信履歴が記録される

---

## 追加のデバッグツール

### データベース直接確認

```sql
-- 最近のジョブ確認
SELECT id, type, status, meeting_id, meeting_topic, created_at 
FROM agent_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- 議事録確認
SELECT id, meeting_topic, summary, created_at 
FROM meeting_transcripts 
ORDER BY created_at DESC 
LIMIT 5;

-- 配信ログ確認
SELECT transcript_id, recipient_email, status, sent_at 
FROM distribution_logs 
ORDER BY sent_at DESC 
LIMIT 10;
```

### API直接テスト

```bash
# ヘルスチェック
curl http://localhost:8000/health

# デバッグ状態確認
curl http://localhost:8000/api/debug/status

# 認証テスト
curl -X POST http://localhost:8000/api/debug/test-auth
```

このガイドを使用して、Zoom連携機能の各段階を体系的にデバッグし、問題を特定・解決してください。