# AIエージェントサービス プロジェクト概要

## プロジェクト目的
Zoom会議終了後に議事録を自動生成・配布するマイクロサービス型フルスタックアプリケーション

## 主な機能
- Zoom Webhook受信による自動処理トリガー
- OpenAI Whisper APIによる音声文字起こし
- Anthropic Claude APIによる議事録生成
- 自動メール配布システム
- テナント別権限管理
- 議事録管理・閲覧機能

## アーキテクチャ構成

### マイクロサービス構成
- **Backend**: Express.js RESTful API (Node.js)
- **Frontend**: React + Vite + TypeScript
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7 + Bull Queue
- **AI Services**: OpenAI Whisper + Anthropic Claude
- **Container**: Docker Compose

### 認証システム
- JWT認証 + ロールベース権限管理 ('admin'/'user')
- ローカルストレージによる認証状態永続化

### 主要サービス
- **Backend API**: Express.js (ポート8000)
- **Frontend**: React + Vite (ポート3000)
- **Database**: PostgreSQL (ポート5432)
- **Redis**: キュー管理 (ポート6379)
- **MailHog**: 開発用メールテスト (ポート8025)

## 技術スタック

### Backend
- Express.js
- PostgreSQL (pg)
- Redis + Bull Queue
- JWT (jsonwebtoken)
- bcryptjs (認証)
- Winston (ログ)
- Helmet + CORS (セキュリティ)

### Frontend
- React 19
- TypeScript (strict mode)
- Vite
- React Router
- TanStack React Query
- React Hook Form
- Tailwind CSS
- Headless UI
- Lucide React (アイコン)

### AI/External APIs
- OpenAI API (Whisper)
- Anthropic API (Claude)
- Zoom API (Server-to-Server OAuth)