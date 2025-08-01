-- ===================================
-- 既存テーブルにテナントID追加
-- ===================================

-- 1. 既存テーブルにテナントIDカラム追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);
ALTER TABLE meeting_transcripts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);

-- distribution_logsテーブルが存在するかチェックして追加
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'distribution_logs') THEN
        ALTER TABLE distribution_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(8);
    END IF;
END
$$;

-- 2. 既存データをデフォルトテナントに移行
UPDATE users SET tenant_id = 'default0' WHERE tenant_id IS NULL;
UPDATE agent_jobs SET tenant_id = 'default0' WHERE tenant_id IS NULL;
UPDATE meeting_transcripts SET tenant_id = 'default0' WHERE tenant_id IS NULL;

-- distribution_logsが存在する場合のみ更新
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'distribution_logs') THEN
        UPDATE distribution_logs SET tenant_id = 'default0' WHERE tenant_id IS NULL;
    END IF;
END
$$;

-- 3. ユーザーロールにテナント管理者を追加
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
        ALTER TABLE users ADD CONSTRAINT check_user_role 
            CHECK (role IN ('admin', 'user', 'tenant_admin'));
    END IF;
END
$$;