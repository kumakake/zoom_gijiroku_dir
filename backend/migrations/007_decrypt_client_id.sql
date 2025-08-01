-- Client IDの暗号化を解除
-- Client IDは機密情報ではないため、平文で保存する

-- 既存の暗号化されたClient IDを削除
UPDATE zoom_tenant_settings 
SET zoom_client_id = NULL 
WHERE zoom_client_id IS NOT NULL 
  AND zoom_client_id LIKE '%:%';

-- 説明コメント
COMMENT ON COLUMN zoom_tenant_settings.zoom_client_id IS 'Zoom Client ID (plain text, not encrypted)';