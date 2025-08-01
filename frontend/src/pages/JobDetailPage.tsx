import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface JobDetail {
  agent_job_uuid: string;
  type: string;
  status: string;
  trigger_data?: any;
  error_message?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  created_by_uuid?: string;
  created_by_name?: string;
  created_by_email?: string;
}

const JobDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  // State管理
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  // データ取得
  const loadJob = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await agentApi.getJob(id);
      setJob(response.job);
    } catch (error) {
      console.error('ジョブ詳細の取得に失敗:', error);
      toast.error('ジョブ詳細の取得に失敗しました');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };
  
  // 初期データ読み込み
  useEffect(() => {
    loadJob();
  }, [id]);
  
  // ステータス表示用のスタイリング
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' };
      case 'processing':
        return { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      case 'completed':
        return { backgroundColor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0' };
      case 'failed':
        return { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' };
    }
  };
  
  // ステータスの日本語表示
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待機中';
      case 'processing': return '処理中';
      case 'completed': return '完了';
      case 'failed': return '失敗';
      default: return status;
    }
  };
  
  // ジョブタイプの日本語表示
  const getTypeText = (type: string) => {
    switch (type) {
      case 'transcript_generation': return '議事録生成';
      case 'audio_transcription': return '音声文字起こし';
      case 'email_distribution': return 'メール配布';
      case 'file_processing': return 'ファイル処理';
      default: return type;
    }
  };
  
  // 実行時間の計算
  const getDuration = (job: JobDetail) => {
    if (!job.updated_at) return '-';
    
    const startTime = new Date(job.created_at);
    const endTime = job.completed_at ? new Date(job.completed_at) : job.updated_at ? new Date(job.updated_at) : new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}時間${Math.floor((duration % 3600) / 60)}分`;
  };
  
  // JSONデータの整形表示
  const formatJsonData = (data: any) => {
    if (!data) return 'データなし';
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };
  
  if (loading) {
    return (
      <div className="dashboard">
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <LoadingSpinner />
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>ジョブ詳細を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!job) {
    return (
      <div className="dashboard">
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>😞</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: '0 0 1rem 0' }}>
              ジョブが見つかりません
            </h3>
            <button
              onClick={() => navigate('/jobs')}
              className="profile-form-button"
            >
              ← ジョブ一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <div className="dashboard-logo-icon">
              ⚙️
            </div>
            <div>
              <h1 className="dashboard-title">
                {getTypeText(job.type)}
              </h1>
              <p className="dashboard-subtitle">
                {new Date(job.created_at).toLocaleDateString('ja-JP')} • {getDuration(job)}
              </p>
            </div>
          </div>
          <div className="dashboard-nav">
            <Link to="/jobs" className="dashboard-nav-link">
              ← ジョブ一覧
            </Link>
            <Link to="/profile" className="dashboard-nav-link">
              プロフィール
            </Link>
            <button onClick={logout} className="dashboard-logout-btn">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* ジョブ基本情報セクション */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">⚙️ ジョブ情報</h2>
          </div>
          <div className="profile-section-content">
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">🆔 ジョブID</span>
                <div className="profile-info-value">
                  {job.agent_job_uuid}
                </div>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">📊 ステータス</span>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...getStatusStyle(job.status)
                }}>
                  {getStatusText(job.status)}
                </div>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">📅 作成日時</span>
                <div className="profile-info-value">
                  {new Date(job.created_at).toLocaleString('ja-JP')}
                </div>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">⏱️ 実行時間</span>
                <div className="profile-info-value">
                  {getDuration(job)}
                </div>
              </div>
              {job.updated_at && (
                <div className="profile-info-item">
                  <span className="profile-info-label">🔄 更新日時</span>
                  <div className="profile-info-value">
                    {new Date(job.updated_at).toLocaleString('ja-JP')}
                  </div>
                </div>
              )}
              {job.completed_at && (
                <div className="profile-info-item">
                  <span className="profile-info-label">✅ 完了日時</span>
                  <div className="profile-info-value">
                    {new Date(job.completed_at).toLocaleString('ja-JP')}
                  </div>
                </div>
              )}
              {job.created_by_name && (
                <div className="profile-info-item">
                  <span className="profile-info-label">👤 作成者</span>
                  <div className="profile-info-value">
                    {job.created_by_name}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* エラーメッセージセクション */}
        {job.status === 'failed' && job.error_message && (
          <div className="profile-section">
            <div className="profile-section-header">
              <h2 className="profile-section-title">❌ エラー情報</h2>
            </div>
            <div className="profile-section-content">
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#fef2f2', 
                borderRadius: '0.5rem',
                border: '1px solid #fecaca'
              }}>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '0.875rem', 
                  color: '#dc2626',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  margin: 0
                }}>
                  {job.error_message}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* トリガーデータセクション */}
        {job.trigger_data && (
          <div className="profile-section">
            <div className="profile-section-header">
              <h2 className="profile-section-title">📋 トリガーデータ</h2>
            </div>
            <div className="profile-section-content">
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#f8fafc', 
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '0.875rem', 
                  color: '#1f2937',
                  fontFamily: 'monospace',
                  lineHeight: 1.6,
                  margin: 0
                }}>
                  {formatJsonData(job.trigger_data)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 更新情報 */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '0.875rem', 
          color: '#6b7280',
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          border: '1px solid #f1f5f9'
        }}>
          🕒 最終更新: {new Date().toLocaleString('ja-JP')}
          <button
            onClick={loadJob}
            className="profile-form-button"
            style={{ 
              minWidth: 'auto', 
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              marginLeft: '1rem'
            }}
          >
            🔄 再読み込み
          </button>
        </div>
      </main>
    </div>
  );
};

export default JobDetailPage;
