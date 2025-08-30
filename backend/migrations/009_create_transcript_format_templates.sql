-- 議事録フォーマットテンプレート管理テーブル作成
-- テナント単位でカスタマイズ可能な議事録フォーマットを管理

CREATE TABLE transcript_format_templates (
	id SERIAL PRIMARY KEY,
	template_uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
	tenant_id VARCHAR(8) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
	template_name VARCHAR(255) NOT NULL,
	template_description TEXT,
	format_structure JSONB NOT NULL, -- ドラッグ&ドロップで作成されるフォーマット構造
	is_default BOOLEAN DEFAULT false, -- デフォルトテンプレートフラグ
	is_active BOOLEAN DEFAULT true,
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_transcript_format_templates_tenant_id ON transcript_format_templates(tenant_id);
CREATE INDEX idx_transcript_format_templates_active ON transcript_format_templates(is_active);
CREATE INDEX idx_transcript_format_templates_default ON transcript_format_templates(tenant_id, is_default) WHERE is_default = true;

-- updated_atカラムの自動更新トリガー
CREATE TRIGGER update_transcript_format_templates_updated_at
	BEFORE UPDATE ON transcript_format_templates
	FOR EACH ROW
	EXECUTE FUNCTION update_updated_at_column();

-- テナント当たり1つのデフォルトテンプレートのみ許可
CREATE UNIQUE INDEX idx_transcript_format_templates_one_default_per_tenant
	ON transcript_format_templates(tenant_id)
	WHERE is_default = true;

-- デフォルトテンプレートの挿入（既存テナント用）
INSERT INTO transcript_format_templates (
	tenant_id,
	template_name,
	template_description,
	format_structure,
	is_default,
	is_active
) VALUES (
	'default0',
	'標準議事録フォーマット',
	'デフォルトのMarkdown形式議事録テンプレート',
	'{
		"sections": [
			{
				"id": "header",
				"type": "header",
				"title": "会議情報",
				"fields": ["meeting_topic", "start_time", "duration", "participants"],
				"order": 1
			},
			{
				"id": "summary",
				"type": "summary",
				"title": "要約",
				"fields": ["summary"],
				"order": 2
			},
			{
				"id": "content",
				"type": "content",
				"title": "議事録詳細",
				"fields": ["formatted_transcript"],
				"order": 3
			},
			{
				"id": "actions",
				"type": "action_items",
				"title": "アクションアイテム",
				"fields": ["action_items"],
				"order": 4
			}
		],
		"styling": {
			"use_markdown": true,
			"include_timestamps": true,
			"include_speakers": true
		}
	}'::JSONB,
	true,
	true
);