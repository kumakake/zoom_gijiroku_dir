-- ===================================
-- 基本テナントテーブル作成
-- ===================================

-- 1. テナント管理テーブル作成
CREATE TABLE IF NOT EXISTS tenants (
	id SERIAL PRIMARY KEY,
	tenant_id VARCHAR(8) UNIQUE NOT NULL,
	name VARCHAR(255) NOT NULL,
	admin_email VARCHAR(255),
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. テナント別Zoom設定テーブル作成
CREATE TABLE IF NOT EXISTS zoom_tenant_settings (
	id SERIAL PRIMARY KEY,
	tenant_id VARCHAR(8),
	zoom_api_key VARCHAR(255) NOT NULL,
	zoom_api_secret VARCHAR(255) NOT NULL,
	zoom_webhook_secret VARCHAR(255) NOT NULL,
	zoom_account_id VARCHAR(255),
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. デフォルトテナント作成
INSERT INTO tenants (tenant_id, name, admin_email, is_active) 
VALUES ('default0', 'デフォルトテナント', 'admin@example.com', true)
ON CONFLICT (tenant_id) DO NOTHING;