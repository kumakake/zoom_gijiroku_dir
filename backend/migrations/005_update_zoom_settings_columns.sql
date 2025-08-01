-- Zoom設定テーブルのカラム名更新マイグレーション
-- API Key/Secret → Client ID/Secret

-- 新しいカラムを追加
ALTER TABLE zoom_tenant_settings 
ADD COLUMN IF NOT EXISTS zoom_client_id character varying(255);

ALTER TABLE zoom_tenant_settings 
ADD COLUMN IF NOT EXISTS zoom_client_secret character varying(255);

-- 既存データを新しいカラムにコピー
UPDATE zoom_tenant_settings 
SET zoom_client_id = zoom_api_key
WHERE zoom_api_key IS NOT NULL;

UPDATE zoom_tenant_settings 
SET zoom_client_secret = zoom_api_secret
WHERE zoom_api_secret IS NOT NULL;

-- 古いカラムを削除（段階的に実行）
-- 注意：本番環境では慎重に実行
ALTER TABLE zoom_tenant_settings 
DROP COLUMN IF EXISTS zoom_api_key;

ALTER TABLE zoom_tenant_settings 
DROP COLUMN IF EXISTS zoom_api_secret;

-- インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_zoom_tenant_settings_tenant_id 
ON zoom_tenant_settings(tenant_id);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_zoom_tenant_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_zoom_tenant_settings_updated_at ON zoom_tenant_settings;
CREATE TRIGGER trigger_zoom_tenant_settings_updated_at
    BEFORE UPDATE ON zoom_tenant_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_zoom_tenant_settings_updated_at();