# テナント管理者向けZoom設定ガイド

## 1ページ目：Zoom設定項目の概要

### テナント管理者ページのZoom設定項目

テナント管理者として、Zoom会議の自動議事録作成機能を利用するために、以下の4つのパラメータを設定する必要があります。

---

### 🔧 **設定必須パラメータ**

#### **1. Zoom Account ID**
- **役割**: Zoomアカウントを一意に識別するID
- **取得方法**: Zoom Marketplace > 作成したアプリ > App Credentials > Account ID
- **形式例**: `abcd-1234_aBcD-5678-EfGh`
- **入力例**: アルファベット・数字・ハイフンの組み合わせ

#### **2. Client ID**
- **役割**: 作成したZoomアプリケーションの公開識別子
- **取得方法**: Zoom Marketplace > 作成したアプリ > App Credentials > Client ID
- **形式例**: `xyz123ABCdef456GHI`
- **注意事項**: 公開情報のため機密ではない

#### **3. Client Secret**
- **役割**: Zoomアプリケーションの秘密鍵（最重要）
- **取得方法**: Zoom Marketplace > 作成したアプリ > App Credentials > Client Secret
- **セキュリティ**: 🔒 暗号化してデータベースに保存
- **表示**: 設定後は「設定済み」「未設定」のステータスのみ表示

#### **4. Webhook Secret**
- **役割**: Zoom会議終了時の通知を受信するための署名検証鍵
- **取得方法**: Zoom Marketplace > 作成したアプリ > Features > Event Subscriptions > Webhook Secret
- **セキュリティ**: 🔒 暗号化してデータベースに保存
- **用途**: 会議終了・録画完了の通知受信時の認証

---

### 🌐 **Webhook URL情報**

**自動生成されるWebhook URL**:
```
https://zm01.ast-tools.online/api/webhooks/zoom/{テナントID}
```
- この URLをZoom Marketplace のEvent SubscriptionsのEndpoint URLに設定
- テナントID は自動的に付与される一意の識別子

---

## 2ページ目：Zoomアプリケーション設定詳細

### 📋 **Zoomアプリで設定が必要な項目**

#### **Event Subscriptions（イベント購読）**

| カテゴリ | イベント名 | 説明 |
|----------|------------|------|
| **Meeting** | End Meeting | 会議終了時の通知 |
| **Recording** | All Recordings have completed | すべての録画完了通知 |
| **Recording** | Recording Transcript files have completed | 字幕ファイル作成完了通知 |

#### **Scopes（権限スコープ）**

| カテゴリ | 権限 | 説明 |
|----------|------|------|
| **Meeting** | `meeting:read:meeting:admin` | 会議情報の参照 |
| **Recording** | `cloud_recording:read:recording:admin` | 録画情報の参照 |
| **Recording** | `cloud_recording:read:list_recording_files:admin` | 録画ファイル一覧の取得 |
| **Report** | `report:read:list_meeting_participants:admin` | 参加者情報の取得 |

---

### ⚙️ **Zoom管理画面での追加設定**

#### **重要：VTTファイル保存設定**

**設定場所**: 
- Zoomログイン > 管理者/アカウント管理/アカウント設定 > レコーディングとお文字起こし

**必須設定**:
- ✅ **「字幕をVTTファイルとして保存する」をチェック**

**設定箇所**:
1. 「その他の設定」セクション
2. 「クラウドレコーディング設定」セクション

**重要性**: 
- この設定により、AI自動議事録作成に必要なVTT字幕ファイルが生成される
- 設定しないと議事録の品質が大幅に低下する

---

### 🔄 **設定完了後の動作フロー**

1. **会議終了** → Zoom から Webhook通知
2. **録画完了** → 録画ファイル・VTTファイル取得
3. **AI処理** → OpenAI Whisper + Anthropic Claude
4. **議事録配布** → 自動メール送信
5. **履歴保存** → システム内で議事録管理

---

### 💡 **トラブルシューティングのヒント**

- **設定が反映されない場合**: ブラウザの再読み込みと設定確認
- **Webhook受信エラー**: URLの正確性とSecret鍵の一致確認
- **権限エラー**: Scope設定の再確認
- **VTTファイル未生成**: Zoom管理画面の字幕保存設定確認

---

*このガイドを参考に、Zoom設定を完了してください。設定後は自動的に会議の議事録作成・配布が開始されます。*