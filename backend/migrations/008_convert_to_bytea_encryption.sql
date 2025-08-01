-- PostgreSQL bytea型での暗号化システムへの移行
-- pgcrypto拡張を使用したAES-256暗号化

-- pgcrypto拡張を有効化
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 新しいbytea型カラムを追加
ALTER TABLE zoom_tenant_settings 
ADD COLUMN IF NOT EXISTS zoom_client_secret_encrypted bytea;

ALTER TABLE zoom_tenant_settings 
ADD COLUMN IF NOT EXISTS zoom_webhook_secret_encrypted bytea;

-- 既存の暗号化されたデータをクリア（新方式で再入力が必要）
UPDATE zoom_tenant_settings 
SET zoom_client_secret = NULL, zoom_webhook_secret = NULL;

-- 説明コメント
COMMENT ON COLUMN zoom_tenant_settings.zoom_client_secret_encrypted IS 'Zoom Client Secret (PostgreSQL bytea encrypted)';
COMMENT ON COLUMN zoom_tenant_settings.zoom_webhook_secret_encrypted IS 'Zoom Webhook Secret (PostgreSQL bytea encrypted)';

-- 将来的に古いカラムを削除する予定（今回は残しておく）
-- ALTER TABLE zoom_tenant_settings DROP COLUMN zoom_client_secret;
-- ALTER TABLE zoom_tenant_settings DROP COLUMN zoom_webhook_secret;