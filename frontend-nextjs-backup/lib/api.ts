import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

// API クライアントのベース設定
const createApiClient = (): AxiosInstance => {
	// ブラウザ側では localhost を使用、サーバー側では backend サービス名を使用
	const baseURL = typeof window !== 'undefined' 
		? (process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000')
		: (process.env.BACKEND_API_URL || 'http://backend:8000');
	
	const client = axios.create({
		baseURL,
		timeout: 10000,
		headers: {
			'Content-Type': 'application/json',
		},
	});

	// リクエストインターセプター（認証トークンの自動付与）
	client.interceptors.request.use(
		async (config) => {
			const session = await getSession();
			
			if (session?.accessToken) {
				config.headers.Authorization = `Bearer ${session.accessToken}`;
				console.log(`API Request: ${config.method?.toUpperCase()} ${config.url} (Token: ${session.accessToken.substring(0, 10)}...)`);
			} else {
				console.warn(`API Request: ${config.method?.toUpperCase()} ${config.url} - 認証トークンが見つかりません`);
				console.warn('セッション状態:', session);
			}

			return config;
		},
		(error) => {
			console.error('リクエストエラー:', error);
			return Promise.reject(error);
		}
	);

	// レスポンスインターセプター（エラーハンドリング）
	client.interceptors.response.use(
		(response) => {
			console.log(`API Response: ${response.status} ${response.config.url}`);
			return response;
		},
		(error) => {
			console.error('レスポンスエラー:', error.response?.data || (error instanceof Error ? error.message : 'Unknown error'));
			
			// エラーメッセージの表示
			const errorMessage = error.response?.data?.error || 'APIエラーが発生しました';
			
			if (error.response?.status === 401) {
				toast.error('認証が必要です。再度ログインしてください。');
				// 必要に応じてログアウト処理を追加
			} else if (error.response?.status === 403) {
				toast.error('この操作を実行する権限がありません。');
			} else if (error.response?.status >= 500) {
				toast.error('サーバーエラーが発生しました。しばらく待ってから再試行してください。');
			} else {
				toast.error(errorMessage);
			}
			
			return Promise.reject(error);
		}
	);

	return client;
};

// APIクライアントのインスタンス
export const apiClient = createApiClient();

// 認証関連のAPI
export const authApi = {
	// ログイン
	login: async (credentials: { email: string; password: string }) => {
		const response = await apiClient.post('/api/auth/login', credentials);
		return response.data;
	},
	
	// ユーザー登録
	register: async (userData: { email: string; name: string; password: string }) => {
		const response = await apiClient.post('/api/auth/register', userData);
		return response.data;
	},
	
	// ユーザー情報取得
	getMe: async () => {
		const response = await apiClient.get('/api/auth/me');
		return response.data;
	},
	
	// パスワード変更
	changePassword: async (passwords: { currentPassword: string; newPassword: string }) => {
		const response = await apiClient.put('/api/auth/change-password', passwords);
		return response.data;
	},
	
	// プロファイル更新
	updateProfile: async (profileData: { name: string; email_distribution_preference?: string }) => {
		const response = await apiClient.put('/api/auth/update-profile', profileData);
		return response.data;
	},
};

// エージェントジョブ関連のAPI
export const agentApi = {
	// ジョブ一覧取得
	getJobs: async (params?: { page?: number; limit?: number; status?: string; type?: string }) => {
		const response = await apiClient.get('/api/agent/jobs', { params });
		return response.data;
	},
	
	// ジョブ詳細取得
	getJob: async (jobUuid: string) => {
		const response = await apiClient.get(`/api/agent/jobs/${jobUuid}`);
		return response.data;
	},
	
	// 統計データ取得
	getStats: async () => {
		const response = await apiClient.get('/api/agent/stats');
		return response.data;
	},
	
	// 設定取得
	getSettings: async () => {
		const response = await apiClient.get('/api/agent/settings');
		return response.data;
	},
	
	// 設定更新
	updateSettings: async (settings: Record<string, any>) => {
		const response = await apiClient.put('/api/agent/settings', { settings });
		return response.data;
	},
};

// 議事録関連のAPI
export const transcriptApi = {
	// 議事録統計取得
	getStats: async () => {
		const response = await apiClient.get('/api/transcripts/stats');
		return response.data;
	},
	
	// 議事録一覧取得
	getTranscripts: async (params?: { 
		page?: number; 
		limit?: number; 
		search?: string; 
		status?: string;
		date_range?: string;
	}) => {
		const response = await apiClient.get('/api/transcripts', { params });
		return response.data;
	},
	
	// 議事録詳細取得
	getTranscript: async (transcriptUuid: string) => {
		const response = await apiClient.get(`/api/transcripts/${transcriptUuid}`);
		return response.data;
	},
	
	// 議事録編集
	updateTranscript: async (transcriptUuid: string, data: {
		formatted_transcript?: string;
		summary?: string;
		action_items?: any[];
	}) => {
		const response = await apiClient.put(`/api/transcripts/${transcriptUuid}`, data);
		return response.data;
	},
	
	// 議事録再配布
	redistributeTranscript: async (transcriptUuid: string, recipients?: Array<{
		type: 'email' | 'workflow_api' | 'slack';
		id: string;
	}>) => {
		// デフォルトの配布先を使用する場合
		const requestData = recipients ? { recipients } : {};
		const response = await apiClient.post(`/api/transcripts/${transcriptUuid}/redistribute`, requestData);
		return response.data;
	},
	
	// 議事録削除
	deleteTranscript: async (transcriptUuid: string) => {
		const response = await apiClient.delete(`/api/transcripts/${transcriptUuid}`);
		return response.data;
	},
};

// ファイルアップロード用のAPI（将来の拡張用）
export const uploadApi = {
	uploadFile: async (file: File, endpoint: string = '/api/upload') => {
		const formData = new FormData();
		formData.append('file', file);
		
		const response = await apiClient.post(endpoint, formData, {
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		});
		
		return response.data;
	},
};

// カスタムHTTP クライアント（NextAuth以外での使用）
export const createCustomClient = (token?: string): AxiosInstance => {
	const client = createApiClient();
	
	if (token) {
		client.defaults.headers.Authorization = `Bearer ${token}`;
	}
	
	return client;
};