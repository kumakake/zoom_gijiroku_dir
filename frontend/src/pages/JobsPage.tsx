import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface AgentJob {
  agent_job_uuid: string;
  id: string;
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

interface JobsResponse {
  jobs: AgentJob[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

const JobsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // State管理
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  // データ取得
  const loadJobs = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      
      const response: JobsResponse = await agentApi.getJobs(params);
      
      // 表示件数を強制的に制限
      const limitedJobs = (response.jobs || []).slice(0, pagination.limit);
      setJobs(limitedJobs);
      // バックエンドの pagination 構造に合わせて変換
      if (response.pagination) {
        setPagination({
          page: response.pagination.currentPage || 1,
          limit: params.limit,
          total: response.pagination.totalCount || 0,
          pages: response.pagination.totalPages || 0
        });
      }
    } catch (error) {
      console.error('ジョブ一覧の取得に失敗:', error);
      toast.error('ジョブ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  // 初期データ読み込み
  useEffect(() => {
    loadJobs();
  }, [pagination.page, statusFilter, typeFilter]);
  
  // ページ変更
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };
  
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
  const getDuration = (job: AgentJob) => {
    if (!job.created_at) return '-';
    
    const startTime = new Date(job.created_at);
    const endTime = job.completed_at ? new Date(job.completed_at) : job.updated_at ? new Date(job.updated_at) : new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    if (duration < 0) return '-';
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}時間${Math.floor((duration % 3600) / 60)}分`;
  };

  // 会議情報を取得（trigger_dataから）
  const getMeetingInfo = (job: AgentJob) => {
    if (!job.trigger_data) return null;
    
    try {
      const data = typeof job.trigger_data === 'string' ? JSON.parse(job.trigger_data) : job.trigger_data;
      return {
        meetingId: data.meeting_id || data.zoom_meeting_id,
        duration: data.duration,
        startTime: data.start_time,
        topic: data.topic || data.meeting_topic
      };
    } catch {
      return null;
    }
  };

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
              <h1 className="dashboard-title">ジョブ状況</h1>
              <p className="dashboard-subtitle">
                {user?.role === 'admin' ? '全システムのジョブ' : 'あなたのジョブ'}
                {pagination.total > 0 && ` • ${pagination.total}件`}
              </p>
            </div>
          </div>
          <div className="dashboard-nav">
            <Link to="/dashboard" className="dashboard-nav-link">
              ← ダッシュボード
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
        {/* フィルターセクション */}
        <div className="dashboard-section">
          <div className="dashboard-section-content">
            <div className="profile-form-grid">
              <div className="profile-form-group">
                <label className="profile-form-label">ステータス</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="profile-form-select"
                >
                  <option value="">全てのステータス</option>
                  <option value="pending">待機中</option>
                  <option value="processing">処理中</option>
                  <option value="completed">完了</option>
                  <option value="failed">失敗</option>
                </select>
              </div>
              <div className="profile-form-group">
                <label className="profile-form-label">ジョブタイプ</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="profile-form-select"
                >
                  <option value="">全てのタイプ</option>
                  <option value="transcript_generation">議事録生成</option>
                  <option value="audio_transcription">音声文字起こし</option>
                  <option value="email_distribution">メール配布</option>
                  <option value="file_processing">ファイル処理</option>
                </select>
              </div>
              <div className="profile-form-group" style={{ alignSelf: 'end' }}>
                <button 
                  onClick={loadJobs} 
                  className="profile-form-button"
                  disabled={loading}
                >
                  🔄 更新
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ジョブ一覧セクション */}
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            {jobs.length > 0 && pagination.total > 0 && (
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
              </span>
            )}
          </div>
          <div className="dashboard-section-content">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '1rem', color: '#6b7280' }}>ジョブを読み込んでいます...</p>
              </div>
            ) : jobs.length > 0 ? (
              <>
                {/* テーブルヘッダー */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem 0.5rem 0 0',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  border: '1px solid #e2e8f0',
                  borderBottom: 'none'
                }}>
                  <div style={{ minWidth: '3rem', textAlign: 'center' }}>#</div>
                  <div style={{ minWidth: '140px' }}>タイプ</div>
                  <div style={{ minWidth: '100px' }}>ステータス</div>
                  <div style={{ minWidth: '120px' }}>ID</div>
                  <div style={{ minWidth: '80px' }}>処理時間</div>
                  <div style={{ minWidth: '80px' }}>会議時間</div>
                  <div style={{ minWidth: '100px' }}>ユーザー</div>
                  <div style={{ minWidth: '120px' }}>作成日時</div>
                  <div style={{ flex: 1, minWidth: '150px' }}>メッセージ</div>
                  <div style={{ minWidth: '60px', textAlign: 'right' }}>操作</div>
                </div>

                {/* ジョブリスト（テーブル形式） */}
                <div style={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderTop: 'none',
                  borderRadius: '0 0 0.5rem 0.5rem'
                }}>
                  {jobs.map((job, index) => (
                    <div 
                      key={job.agent_job_uuid || job.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '1rem',
                        borderBottom: index < jobs.length - 1 ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onClick={() => navigate(`/jobs/${job.agent_job_uuid || job.id}`)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* 番号 */}
                      <div style={{ 
                        minWidth: '3rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        {pagination && pagination.page && pagination.limit ? 
                          (pagination.page - 1) * pagination.limit + index + 1 : 
                          index + 1
                        }
                      </div>

                      {/* ジョブタイプ */}
                      <div style={{ 
                        minWidth: '140px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        {getTypeText(job.type)}
                      </div>

                      {/* ステータス */}
                      <div style={{ 
                        minWidth: '100px',
                        marginRight: '1rem'
                      }}>
                        <div style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          ...getStatusStyle(job.status)
                        }}>
                          {getStatusText(job.status)}
                        </div>
                      </div>

                      {/* ID */}
                      <div style={{ 
                        minWidth: '120px',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {(() => {
                          const meetingInfo = getMeetingInfo(job);
                          const jobId = (job.agent_job_uuid || job.id);
                          const displayId = meetingInfo?.meetingId || (jobId ? jobId.substring(0, 8) : 'N/A');
                          return displayId;
                        })()}
                      </div>

                      {/* 処理時間 */}
                      <div style={{ 
                        minWidth: '80px',
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {getDuration(job)}
                      </div>

                      {/* 会議時間 */}
                      <div style={{ 
                        minWidth: '80px',
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {(() => {
                          const meetingInfo = getMeetingInfo(job);
                          return meetingInfo?.duration ? `${Math.floor(meetingInfo.duration)}分` : '-';
                        })()}
                      </div>

                      {/* ユーザー */}
                      <div style={{ 
                        minWidth: '100px',
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {job.created_by_name || '-'}
                      </div>

                      {/* 作成日時 */}
                      <div style={{ 
                        minWidth: '120px',
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {new Date(job.created_at).toLocaleString('ja-JP', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>

                      {/* メッセージ */}
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        {job.status === 'failed' && job.error_message && (
                          <div style={{ 
                            fontSize: '0.75rem',
                            color: '#dc2626',
                            backgroundColor: '#fef2f2',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #fecaca'
                          }}>
                            ❌ {job.error_message.length > 50 ? job.error_message.substring(0, 50) + '...' : job.error_message}
                          </div>
                        )}
                        {job.status === 'completed' && (
                          <div style={{ 
                            fontSize: '0.75rem',
                            color: '#059669'
                          }}>
                            ✅ 完了
                          </div>
                        )}
                      </div>

                      {/* 詳細ボタン */}
                      <div style={{ 
                        minWidth: '60px',
                        textAlign: 'right'
                      }}>
                        <div style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          fontSize: '0.625rem',
                          cursor: 'pointer',
                          display: 'inline-block'
                        }}>
                          詳細 →
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ページネーション */}
                {pagination.pages > 1 && (
                  <div style={{ 
                    marginTop: '2rem', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    flexWrap: 'wrap'
                  }}>
                    {/* 最初のページ */}
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.page === 1}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 0.75rem' }}
                    >
                      &lt;&lt;
                    </button>
                    
                    {/* 前のページ */}
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 0.75rem' }}
                    >
                      &lt;
                    </button>
                    
                    {/* ページ番号 */}
                    {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                      let page;
                      if (pagination.pages <= 5) {
                        // 総ページ数が5以下の場合、全ページを表示
                        page = i + 1;
                      } else {
                        // 現在のページを中心に5ページ表示
                        const start = Math.max(1, pagination.page - 2);
                        const end = Math.min(pagination.pages, start + 4);
                        const adjustedStart = Math.max(1, end - 4);
                        page = adjustedStart + i;
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className="profile-form-button"
                          style={{ 
                            minWidth: 'auto', 
                            padding: '0.5rem 0.75rem',
                            backgroundColor: pagination.page === page ? '#2563eb' : '#3b82f6'
                          }}
                        >
                          {page}
                        </button>
                      );
                    })}
                    
                    {/* 次のページ */}
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 0.75rem' }}
                    >
                      &gt;
                    </button>
                    
                    {/* 最後のページ */}
                    <button
                      onClick={() => handlePageChange(pagination.pages)}
                      disabled={pagination.page === pagination.pages}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 0.75rem' }}
                    >
                      &gt;&gt;
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ 
                  fontSize: '4rem', 
                  marginBottom: '1rem',
                  filter: 'grayscale(100%)',
                  opacity: 0.5
                }}>
                  ⚙️
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
                  {statusFilter || typeFilter ? '検索結果なし' : 'ジョブがありません'}
                </h3>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  {statusFilter || typeFilter ? 
                    'フィルター条件に一致するジョブが見つかりません' : 
                    'まだジョブが実行されていません'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default JobsPage;
