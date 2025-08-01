-- AIエージェントサービス用データベーススキーマ初期化
-- 作成日時: 2025年7月1日

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
	session_state VARCHAR(255),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
	id SERIAL PRIMARY KEY,
	session_token VARCHAR(255) UNIQUE NOT NULL,
	user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
	expires TIMESTAMP NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- インデックスの作成
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_agent_jobs_status ON agent_jobs(status);
CREATE INDEX idx_agent_jobs_type ON agent_jobs(type);
CREATE INDEX idx_agent_jobs_created_at ON agent_jobs(created_at);
CREATE INDEX idx_meeting_transcripts_zoom_id ON meeting_transcripts(zoom_meeting_id);
CREATE INDEX idx_meeting_transcripts_start_time ON meeting_transcripts(start_time);
CREATE INDEX idx_distribution_logs_transcript_id ON distribution_logs(transcript_id);
CREATE INDEX idx_distribution_logs_status ON distribution_logs(status);
CREATE INDEX idx_agent_settings_key ON agent_settings(setting_key);

-- テーブル権限の設定
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- デフォルト管理者ユーザーの挿入
INSERT INTO users (email, name, password_hash, role) VALUES 
('admin@example.com', '管理者', '$2b$10$dummy.hash.for.development.only', 'admin');

-- デフォルト設定の挿入
INSERT INTO agent_settings (setting_key, setting_value, description) VALUES 
('smtp_settings', '{"host": "smtp.example.com", "port": 587, "secure": false}', 'メール配信SMTP設定'),
('default_email_recipients', '["admin@example.com"]', 'デフォルトメール配信先'),
('transcript_template', '{"format": "markdown", "include_timestamps": true, "include_action_items": true}', '議事録テンプレート設定'),
('workflow_api_endpoints', '{"base_url": "http://localhost:3000/api", "endpoints": ["/workflows/meeting-follow-up"]}', 'ワークフローAPI連携設定'),
('slack_settings', '{"webhook_url": "", "default_channel": "#general"}', 'Slack連携設定');

-- データベース情報の表示
SELECT 'データベーススキーマの初期化が完了しました' AS status;