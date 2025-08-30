import axios, { AxiosInstance } from 'axios';
import { toast } from 'react-hot-toast';

// API クライアントのベース設定
const createApiClient = (): AxiosInstance => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  const client = axios.create({
    baseURL,
    timeout: 30000, // デフォルトタイムアウトを30秒に延長
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // リクエストインターセプター（認証ヘッダー自動設定）
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // レスポンスインターセプター（エラーハンドリング）
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      
      // エラーメッセージの表示
      const errorMessage = error.response?.data?.error || 'APIエラーが発生しました';
      
      if (error.response?.status === 401) {
        toast.error('認証が必要です。再度ログインしてください。');
        // 認証エラーの場合、ローカルストレージからトークンを削除
        localStorage.removeItem('auth_token');
        delete client.defaults.headers.common['Authorization'];
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
export const api = createApiClient();

// 認証関連のAPI
export const authApi = {
  // ログイン
  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data;
  },
  
  // ユーザー登録
  register: async (userData: { email: string; name: string; password: string }) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },
  
  // ユーザー情報取得
  getProfile: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  
  // パスワード変更
  changePassword: async (passwords: { currentPassword: string; newPassword: string }) => {
    const response = await api.put('/api/auth/change-password', passwords);
    return response.data;
  },
  
  // プロファイル更新
  updateProfile: async (profileData: { name: string; email_distribution_preference?: string }) => {
    const response = await api.put('/api/auth/update-profile', profileData);
    return response.data;
  },
  
  // 汎用GET メソッド
  get: async (endpoint: string, config?: any) => {
    const response = await api.get(endpoint, config);
    return response;
  },
  
  // 汎用POST メソッド
  post: async (endpoint: string, data?: any, config?: any) => {
    const response = await api.post(endpoint, data, config);
    return response;
  },
};

// エージェントジョブ関連のAPI
export const agentApi = {
  // ジョブ一覧取得
  getJobs: async (params?: { page?: number; limit?: number; status?: string; type?: string }) => {
    const response = await api.get('/api/agent/jobs', { params });
    return response.data;
  },
  
  // ジョブ詳細取得
  getJob: async (jobUuid: string) => {
    const response = await api.get(`/api/agent/jobs/${jobUuid}`);
    return response.data;
  },
  
  // 統計データ取得
  getStats: async () => {
    const response = await api.get('/api/agent/stats');
    return response.data;
  },
  
  // 設定取得
  getSettings: async () => {
    const response = await api.get('/api/agent/settings');
    return response.data;
  },
  
  // 設定更新
  updateSettings: async (settings: Record<string, any>) => {
    const response = await api.put('/api/agent/settings', { settings });
    return response.data;
  },
};

// 議事録関連のAPI
export const transcriptApi = {
  // 議事録統計取得
  getStats: async () => {
    const response = await api.get('/api/transcripts/stats');
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
    const response = await api.get('/api/transcripts', { params });
    return response.data;
  },
  
  // 議事録詳細取得
  getTranscript: async (transcriptUuid: string) => {
    const response = await api.get(`/api/transcripts/${transcriptUuid}`);
    return response.data;
  },
  
  // 議事録編集
  updateTranscript: async (transcriptUuid: string, data: {
    formatted_transcript?: string;
    summary?: string;
    action_items?: any[];
  }) => {
    const response = await api.put(`/api/transcripts/${transcriptUuid}`, data);
    return response.data;
  },
  
  // 議事録再配布
  redistributeTranscript: async (transcriptUuid: string, recipients?: Array<{
    type: 'email' | 'workflow_api' | 'slack';
    id: string;
  }>) => {
    const requestData = recipients ? { recipients } : {};
    const response = await api.post(`/api/transcripts/${transcriptUuid}/redistribute`, requestData);
    return response.data;
  },
  
  // 議事録削除
  deleteTranscript: async (transcriptUuid: string) => {
    const response = await api.delete(`/api/transcripts/${transcriptUuid}`);
    return response.data;
  },
  
  // 配布履歴取得
  getDistributionHistory: async (transcriptUuid: string) => {
    const response = await api.get(`/api/transcripts/${transcriptUuid}/distribution-history`);
    return response.data;
  },
};

// テナント管理関連のAPI
export const tenantApi = {
  // テナント一覧取得
  getTenants: async (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
  }) => {
    const response = await api.get('/admin/tenants', { params });
    return response.data;
  },
  
  // テナント詳細取得
  getTenant: async (tenantId: string) => {
    const response = await api.get(`/admin/tenants/${tenantId}`);
    return response.data;
  },
  
  // テナント作成
  createTenant: async (data: {
    name: string;
    admin_email: string;
  }) => {
    const response = await api.post('/admin/tenants', data);
    return response.data;
  },
  
  // テナント更新
  updateTenant: async (tenantId: string, data: {
    name?: string;
    admin_email?: string;
    is_active?: boolean;
  }) => {
    const response = await api.put(`/admin/tenants/${tenantId}`, data);
    return response.data;
  },
  
  // テナント削除（論理削除）
  deleteTenant: async (tenantId: string) => {
    const response = await api.delete(`/admin/tenants/${tenantId}`);
    return response.data;
  },
  
  // テナント別Zoom設定取得
  getZoomSettings: async (tenantId: string) => {
    const response = await api.get(`/admin/tenants/${tenantId}/zoom-settings`);
    return response.data;
  },

  // テナント別Zoom設定更新
  updateZoomSettings: async (tenantId: string, data: {
    zoom_account_id?: string;
    zoom_client_id?: string;
    zoom_client_secret?: string;
    zoom_webhook_secret?: string;
  }) => {
    const response = await api.put(`/admin/tenants/${tenantId}/zoom-settings`, data);
    return response.data;
  },
}

// テナント管理者用API
export const tenantAdminApi = {
  // 自分のテナント情報取得
  getTenant: async () => {
    const response = await api.get('/tenant-admin/tenant');
    return response.data;
  },
  
  // 自分のテナント情報更新
  updateTenant: async (data: {
    name?: string;
    admin_email?: string;
  }) => {
    const response = await api.put('/tenant-admin/tenant', data);
    return response.data;
  },
  
  // 自分のZoom設定取得
  getZoomSettings: async () => {
    const response = await api.get('/tenant-admin/zoom-settings');
    return response.data;
  },
  
  // 自分のZoom設定更新
  updateZoomSettings: async (data: {
    zoom_account_id?: string;
    zoom_client_id?: string;
    zoom_client_secret?: string;
    zoom_webhook_secret?: string;
  }) => {
    const response = await api.put('/tenant-admin/zoom-settings', data);
    return response.data;
  },
}

// システム統計取得
export const systemApi = {
  getSystemStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
};

// 議事録フォーマットテンプレート用のAPI
export const transcriptTemplateApi = {
  // テンプレート一覧取得
  getTemplates: async () => {
    const response = await api.get('/api/transcript-templates');
    return response.data;
  },

  // 特定のテンプレート取得
  getTemplate: async (templateUuid: string) => {
    const response = await api.get(`/api/transcript-templates/${templateUuid}`);
    return response.data;
  },

  // テンプレート作成
  createTemplate: async (data: object) => {
    const response = await api.post('/api/transcript-templates', data);
    return response.data;
  },

  // テンプレート更新
  updateTemplate: async (templateUuid: string, data: object) => {
    const response = await api.put(`/api/transcript-templates/${templateUuid}`, data);
    return response.data;
  },

  // テンプレート削除
  deleteTemplate: async (templateUuid: string) => {
    const response = await api.delete(`/api/transcript-templates/${templateUuid}`);
    return response.data;
  },

  // プレビュー生成
  generatePreview: async (formatStructure: object) => {
    const response = await api.post('/api/transcript-templates/preview', {
      format_structure: formatStructure
    });
    return response.data;
  },
};

// ファイルアップロード用のAPI
export const uploadApi = {
  uploadFile: async (file: File, endpoint: string = '/api/upload') => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
};
