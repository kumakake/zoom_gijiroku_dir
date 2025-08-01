-- zoom_webhook_secretカラムのNOT NULL制約を削除
-- Webhook Secretは必須ではないため、NULLを許可する

ALTER TABLE zoom_tenant_settings 
ALTER COLUMN zoom_webhook_secret DROP NOT NULL;

-- 説明コメント
COMMENT ON COLUMN zoom_tenant_settings.zoom_webhook_secret IS 'Zoom Webhook Secret (optional)';