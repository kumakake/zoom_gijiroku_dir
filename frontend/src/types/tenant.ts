// テナント関連の型定義

export interface Tenant {
	tenant_id: string;
	name: string;
	admin_email: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	user_count?: string | number;
	stats?: TenantStats;
}

export interface TenantStats {
	user_count: number;
	job_count: number;
	transcript_count: number;
}

export interface TenantFormData {
	name: string;
	admin_email: string;
}

export interface TenantUpdateData {
	name?: string;
	admin_email?: string;
	is_active?: boolean;
}

export interface ZoomSettings {
	tenant_id: string;
	zoom_account_id?: string;
	zoom_client_id?: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	client_id: boolean;
	client_secret: boolean;
	webhook_secret: boolean;
	// 下位互換性のための旧フィールド（廃止予定）
	api_key_status?: 'configured' | 'not_configured';
	api_secret_status?: 'configured' | 'not_configured';
	client_id_status?: 'configured' | 'not_configured';
	client_secret_status?: 'configured' | 'not_configured';
	webhook_secret_status?: 'configured' | 'not_configured';
}

export interface TenantListResponse {
	tenants: Tenant[];
	pagination: {
		currentPage: number;
		totalPages: number;
		totalCount: number;
		limit: number;
	};
}

export interface TenantDetailResponse {
	tenant: Tenant;
}

export interface SystemStats {
	total_tenants: number;
	total_users: number;
	total_jobs: number;
	total_transcripts: number;
}

export interface SystemStatsResponse {
	stats: SystemStats;
}

export interface TenantSearchParams {
	page?: number;
	limit?: number;
	search?: string;
}

// 議事録フォーマットテンプレート関連の型定義
export interface TranscriptFormatTemplate {
	template_uuid: string;
	template_name: string;
	template_description?: string;
	format_structure: FormatStructure;
	is_default: boolean;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface FormatStructure {
	sections: FormatSection[];
	styling: FormatStyling;
}

export interface FormatSection {
	id: string;
	type: 'header' | 'summary' | 'content' | 'action_items' | 'custom';
	title: string;
	fields: string[];
	order: number;
	custom_content?: string;
}

export interface FormatStyling {
	use_markdown: boolean;
	include_timestamps: boolean;
	include_speakers: boolean;
	custom_css?: string;
}

export interface TranscriptTemplateFormData {
	template_name: string;
	template_description?: string;
	format_structure: FormatStructure;
	is_default?: boolean;
}

export interface TemplatePreviewRequest {
	format_structure: FormatStructure;
}

export interface TemplatePreviewResponse {
	preview_html: string;
	sample_data: Record<string, unknown>;
}