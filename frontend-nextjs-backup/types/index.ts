// ユーザー関連の型定義
export interface User {
	user_uuid: string;
	email: string;
	name: string;
	role: 'admin' | 'user';
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

// 認証関連の型定義
export interface AuthResponse {
	message: string;
	user: User;
	accessToken: string;
	refreshToken: string;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface RegisterCredentials {
	email: string;
	name: string;
	password: string;
}

// エージェントジョブ関連の型定義
export interface AgentJob {
	agent_job_uuid: string;
	type: 'zoom_transcript' | 'meeting_summary';
	status: 'pending' | 'processing' | 'completed' | 'failed';
	created_by_uuid: string;
	createdByName: string;
	triggerData: Record<string, any>;
	inputData: Record<string, any>;
	outputData: Record<string, any>;
	errorMessage: string | null;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
}

// 議事録関連の型定義
export interface MeetingTranscript {
	transcript_uuid: string;
	agent_job_uuid: string;
	zoomMeetingId: string;
	meetingTopic: string;
	startTime: string;
	duration: number;
	participants: Participant[];
	rawTranscript: string;
	formattedTranscript: string;
	summary: string;
	actionItems: ActionItem[];
	createdAt: string;
	jobStatus: string;
	distributionCount: number;
	sentCount: number;
	distributionLogs?: DistributionLog[];
}

export interface Participant {
	id: string;
	name: string;
	email: string;
	joinTime: string;
	leaveTime: string;
}

export interface ActionItem {
	id: string;
	description: string;
	assignee: string;
	dueDate: string;
	priority: 'high' | 'medium' | 'low';
	status: 'pending' | 'in_progress' | 'completed';
}

// 配布履歴関連の型定義
export interface DistributionLog {
	distribution_log_uuid: string;
	transcript_uuid: string;
	recipientType: 'email' | 'workflow_api' | 'slack';
	recipientId: string;
	status: 'pending' | 'sent' | 'failed';
	sentAt: string | null;
	errorMessage: string | null;
	createdAt: string;
}

export interface DistributionRecipient {
	type: 'email' | 'workflow_api' | 'slack';
	id: string;
}

// エージェント設定関連の型定義
export interface AgentSettings {
	[key: string]: {
		value: any;
		description: string;
		updatedAt: string;
	};
}

export interface SmtpSettings {
	host: string;
	port: number;
	secure: boolean;
	auth: {
		user: string;
		pass: string;
	};
}

export interface WorkflowApiSettings {
	baseUrl: string;
	endpoints: string[];
	token: string;
}

export interface SlackSettings {
	webhookUrl: string;
	defaultChannel: string;
	botToken: string;
}

// 統計データ関連の型定義
export interface JobStats {
	totalJobs: number;
	pendingJobs: number;
	processingJobs: number;
	completedJobs: number;
	failedJobs: number;
	todayJobs: number;
}

// API関連の型定義
export interface ApiResponse<T = any> {
	data?: T;
	message?: string;
	error?: string;
	details?: any;
}

export interface PaginatedResponse<T = any> {
	data: T[];
	pagination: {
		currentPage: number;
		totalPages: number;
		totalCount: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
}

// フォーム関連の型定義
export interface TranscriptEditForm {
	formattedTranscript: string;
	summary: string;
	actionItems: ActionItem[];
}

export interface SettingsForm {
	smtpSettings: SmtpSettings;
	workflowApiSettings: WorkflowApiSettings;
	slackSettings: SlackSettings;
	defaultEmailRecipients: string[];
	transcriptTemplate: {
		format: 'markdown' | 'html';
		includeTimestamps: boolean;
		includeActionItems: boolean;
	};
}

// NextAuth.js関連の型定義は types/next-auth.d.ts に移動済み