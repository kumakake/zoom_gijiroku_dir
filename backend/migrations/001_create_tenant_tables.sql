-- ===================================
-- テナント管理システム マイグレーション
-- ファイル: 001_create_tenant_tables.sql
-- 作成日: 2025-01-25
-- ===================================

-- 1. テナント管理テーブル作成
CREATE TABLE IF NOT EXISTS tenants (
	id SERIAL PRIMARY KEY,
	tenant_id VARCHAR(8) UNIQUE NOT NULL,  -- 8桁英数字（例: a7b2c9f1）
	name VARCHAR(255) NOT NULL,
	admin_email VARCHAR(255),
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. テナント別Zoom設定テーブル作成
CREATE TABLE IF NOT EXISTS zoom_tenant_settings (
	id SERIAL PRIMARY KEY,
	tenant_id VARCHAR(8) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
	zoom_api_key VARCHAR(255) NOT NULL,
	zoom_api_secret VARCHAR(255) NOT NULL,
	zoom_webhook_secret VARCHAR(255) NOT NULL,
	zoom_account_id VARCHAR(255),
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 既存テーブルにテナントID追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);
ALTER TABLE meeting_transcripts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);
ALTER TABLE distribution_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);

-- 4. 外部キー制約追加
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS fk_users_tenant 
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);
ALTER TABLE agent_jobs ADD CONSTRAINT IF NOT EXISTS fk_agent_jobs_tenant 
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);
ALTER TABLE meeting_transcripts ADD CONSTRAINT IF NOT EXISTS fk_meeting_transcripts_tenant 
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);
ALTER TABLE distribution_logs ADD CONSTRAINT IF NOT EXISTS fk_distribution_logs_tenant 
	FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);

-- 5. ユーザーロールにテナント管理者を追加
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE users ADD CONSTRAINT check_user_role 
	CHECK (role IN ('admin', 'user', 'tenant_admin'));

-- 6. インデックス作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoom_tenant_settings_tenant_id ON zoom_tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_tenant_id ON agent_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_tenant_id ON meeting_transcripts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_distribution_logs_tenant_id ON distribution_logs(tenant_id);

-- 7. デフォルトテナント作成（既存データ用）
INSERT INTO tenants (tenant_id, name, admin_email, is_active) 
VALUES ('default0', 'デフォルトテナント', 'admin@example.com', true)
ON CONFLICT (tenant_id) DO NOTHING;

-- 8. 既存データをデフォルトテナントに移行
UPDATE users SET tenant_id = 'default0' WHERE tenant_id IS NULL;
UPDATE agent_jobs SET tenant_id = 'default0' WHERE tenant_id IS NULL;
UPDATE meeting_transcripts SET tenant_id = 'default0' WHERE tenant_id IS NULL;
UPDATE distribution_logs SET tenant_id = 'default0' WHERE tenant_id IS NULL;

-- 9. NOT NULL制約追加（既存データ移行後）
-- 一時的にコメントアウト（データが存在する場合に問題が発生する可能性）
-- ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE agent_jobs ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE meeting_transcripts ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE distribution_logs ALTER COLUMN tenant_id SET NOT NULL;

-- 10. 更新日時の自動更新トリガー作成
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = CURRENT_TIMESTAMP;
	RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at 
	BEFORE UPDATE ON tenants 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zoom_tenant_settings_updated_at 
	BEFORE UPDATE ON zoom_tenant_settings 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- マイグレーション完了ログ
INSERT INTO migration_log (migration_name, executed_at) 
VALUES ('001_create_tenant_tables', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;