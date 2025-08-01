-- AIエージェントサービス UUID対応マイグレーション
-- 作成日時: 2025年7月10日
-- 目的: 外部キー関係をUUID対応に修正

-- UUID拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 全テーブルにUUIDカラムを追加
ALTER TABLE users ADD COLUMN user_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();
ALTER TABLE agent_jobs ADD COLUMN agent_job_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();
ALTER TABLE meeting_transcripts ADD COLUMN transcript_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();
ALTER TABLE distribution_logs ADD COLUMN distribution_log_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();
ALTER TABLE agent_settings ADD COLUMN setting_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();
ALTER TABLE accounts ADD COLUMN account_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();
ALTER TABLE sessions ADD COLUMN session_uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4();

-- 2. 外部キー用のUUIDカラムを追加
ALTER TABLE agent_jobs ADD COLUMN created_by_uuid UUID;
ALTER TABLE meeting_transcripts ADD COLUMN agent_job_uuid UUID;
ALTER TABLE distribution_logs ADD COLUMN transcript_uuid UUID;
ALTER TABLE accounts ADD COLUMN user_uuid UUID;
ALTER TABLE sessions ADD COLUMN user_uuid UUID;

-- 3. 既存データのUUID参照を設定
UPDATE agent_jobs 
SET created_by_uuid = users.user_uuid 
FROM users 
WHERE agent_jobs.created_by = users.id;

UPDATE meeting_transcripts 
SET agent_job_uuid = agent_jobs.agent_job_uuid 
FROM agent_jobs 
WHERE meeting_transcripts.agent_job_id = agent_jobs.id;

UPDATE distribution_logs 
SET transcript_uuid = meeting_transcripts.transcript_uuid 
FROM meeting_transcripts 
WHERE distribution_logs.transcript_id = meeting_transcripts.id;

UPDATE accounts 
SET user_uuid = users.user_uuid 
FROM users 
WHERE accounts.user_id = users.id;

UPDATE sessions 
SET user_uuid = users.user_uuid 
FROM users 
WHERE sessions.user_id = users.id;

-- 4. 外部キー制約を追加
ALTER TABLE agent_jobs ADD CONSTRAINT fk_agent_jobs_created_by_uuid 
    FOREIGN KEY (created_by_uuid) REFERENCES users(user_uuid) ON DELETE SET NULL;

ALTER TABLE meeting_transcripts ADD CONSTRAINT fk_meeting_transcripts_agent_job_uuid 
    FOREIGN KEY (agent_job_uuid) REFERENCES agent_jobs(agent_job_uuid) ON DELETE CASCADE;

ALTER TABLE distribution_logs ADD CONSTRAINT fk_distribution_logs_transcript_uuid 
    FOREIGN KEY (transcript_uuid) REFERENCES meeting_transcripts(transcript_uuid) ON DELETE CASCADE;

ALTER TABLE accounts ADD CONSTRAINT fk_accounts_user_uuid 
    FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE;

ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user_uuid 
    FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE;

-- 5. UUIDカラムのインデックスを作成
CREATE INDEX idx_users_user_uuid ON users(user_uuid);
CREATE INDEX idx_agent_jobs_agent_job_uuid ON agent_jobs(agent_job_uuid);
CREATE INDEX idx_agent_jobs_created_by_uuid ON agent_jobs(created_by_uuid);
CREATE INDEX idx_meeting_transcripts_transcript_uuid ON meeting_transcripts(transcript_uuid);
CREATE INDEX idx_meeting_transcripts_agent_job_uuid ON meeting_transcripts(agent_job_uuid);
CREATE INDEX idx_distribution_logs_distribution_log_uuid ON distribution_logs(distribution_log_uuid);
CREATE INDEX idx_distribution_logs_transcript_uuid ON distribution_logs(transcript_uuid);
CREATE INDEX idx_accounts_account_uuid ON accounts(account_uuid);
CREATE INDEX idx_accounts_user_uuid ON accounts(user_uuid);
CREATE INDEX idx_sessions_session_uuid ON sessions(session_uuid);
CREATE INDEX idx_sessions_user_uuid ON sessions(user_uuid);

-- 6. 既存の数値外部キーを非推奨化（段階的移行のため保持）
-- 将来的には削除予定
ALTER TABLE agent_jobs ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE meeting_transcripts ALTER COLUMN agent_job_id DROP NOT NULL;
ALTER TABLE distribution_logs ALTER COLUMN transcript_id DROP NOT NULL;
ALTER TABLE accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN user_id DROP NOT NULL;

-- 7. email_distribution_preferenceカラムを追加（既存機能対応）
ALTER TABLE users ADD COLUMN email_distribution_preference VARCHAR(20) DEFAULT 'host_only';

-- 8. 統計情報の更新
ANALYZE users;
ANALYZE agent_jobs;
ANALYZE meeting_transcripts;
ANALYZE distribution_logs;
ANALYZE accounts;
ANALYZE sessions;

-- 完了メッセージ
SELECT 'UUID対応マイグレーションが完了しました' AS status,
       'テーブル構造確認: SELECT tablename, schemaname FROM pg_tables WHERE schemaname = ''public'';' AS next_step;