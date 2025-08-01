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
	client_id_status: 'configured' | 'not_configured';
	client_secret_status: 'configured' | 'not_configured';
	webhook_secret_status: 'configured' | 'not_configured';
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