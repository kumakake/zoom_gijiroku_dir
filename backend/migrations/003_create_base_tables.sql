-- ===================================
-- 基本テーブル構造作成（テナント対応版）
-- ===================================

-- 1. ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	user_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
	email VARCHAR(255) UNIQUE NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'tenant_admin')),
	tenant_id VARCHAR(8) NOT NULL,
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

-- 2. エージェントジョブテーブル
CREATE TABLE IF NOT EXISTS agent_jobs (
	id SERIAL PRIMARY KEY,
	job_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
	tenant_id VARCHAR(8) NOT NULL,
	created_by_uuid UUID,
	type VARCHAR(100) NOT NULL,
	status VARCHAR(50) DEFAULT 'pending',
	meeting_id VARCHAR(255),
	meeting_url VARCHAR(500),
	data JSONB,
	result JSONB,
	error_message TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	completed_at TIMESTAMP,
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
	FOREIGN KEY (created_by_uuid) REFERENCES users(user_uuid)
);

-- 3. 議事録テーブル
CREATE TABLE IF NOT EXISTS meeting_transcripts (
	id SERIAL PRIMARY KEY,
	transcript_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
	tenant_id VARCHAR(8) NOT NULL,
	created_by_uuid UUID,
	meeting_id VARCHAR(255),
	title VARCHAR(500),
	content TEXT,
	summary TEXT,
	participants JSONB,
	meeting_start_time TIMESTAMP,
	meeting_end_time TIMESTAMP,
	status VARCHAR(50) DEFAULT 'active',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
	FOREIGN KEY (created_by_uuid) REFERENCES users(user_uuid)
);

-- 4. 配布ログテーブル
CREATE TABLE IF NOT EXISTS distribution_logs (
	id SERIAL PRIMARY KEY,
	log_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
	tenant_id VARCHAR(8) NOT NULL,
	transcript_uuid UUID,
	recipient_email VARCHAR(255),
	status VARCHAR(50) DEFAULT 'pending',
	sent_at TIMESTAMP,
	error_message TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
	FOREIGN KEY (transcript_uuid) REFERENCES meeting_transcripts(transcript_uuid)
);

-- 5. 外部キー制約をzoom_tenant_settingsに追加
ALTER TABLE zoom_tenant_settings 
ADD CONSTRAINT fk_zoom_tenant_settings_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- 6. インデックス作成
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_tenant_id ON agent_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_tenant_id ON meeting_transcripts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_distribution_logs_tenant_id ON distribution_logs(tenant_id);

-- 7. デフォルトシステム管理者作成
INSERT INTO users (
	email, 
	password_hash, 
	name, 
	role, 
	tenant_id,
	created_at
) VALUES (
	'admin@example.com',
	'$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedvVrCXyKjn6gKgC', -- DemoPassword123
	'システム管理者',
	'admin',
	'default0',
	CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;