import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { transcriptApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface Transcript {
  transcript_uuid: string;
  id: string;
  zoom_meeting_id: string;
  meeting_topic: string;
  start_time: string;
  duration: number;
  participants: any[];
  summary: string;
  created_at: string;
  created_by_uuid: string;
  created_by_name: string;
  created_by_email: string;
  host_email: string;
  host_name: string;
}

interface TranscriptsResponse {
  transcripts: Transcript[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const TranscriptsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // State管理
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [selectedTranscripts, setSelectedTranscripts] = useState<string[]>([]);
  
  // データ取得
  const loadTranscripts = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      
      if (searchTerm) params.search = searchTerm;
      if (dateRange) params.date_range = dateRange;
      
      const response: TranscriptsResponse = await transcriptApi.getTranscripts(params);
      
      setTranscripts(response.transcripts || []);
      setPagination(response.pagination);
      setSelectedTranscripts([]);
    } catch (error) {
      console.error('議事録一覧の取得に失敗:', error);
      toast.error('議事録一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  // 初期データ読み込み
  useEffect(() => {
    loadTranscripts();
  }, [pagination.page, searchTerm, dateRange]);
  
  // 検索実行
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadTranscripts();
  };
  
  // ページ変更
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };
  
  // 個別削除
  const handleDelete = async (transcriptUuid: string) => {
    if (!confirm('この議事録を削除してもよろしいですか？')) {
      return;
    }
    
    try {
      await transcriptApi.deleteTranscript(transcriptUuid);
      toast.success('議事録を削除しました');
      loadTranscripts();
    } catch (error) {
      console.error('議事録削除エラー:', error);
      toast.error('議事録の削除に失敗しました');
    }
  };
  
  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedTranscripts.length === 0) {
      toast.error('削除する議事録を選択してください');
      return;
    }
    
    if (!confirm(`選択した${selectedTranscripts.length}件の議事録を削除してもよろしいですか？`)) {
      return;
    }
    
    try {
      await Promise.all(
        selectedTranscripts.map(id => transcriptApi.deleteTranscript(id))
      );
      toast.success(`${selectedTranscripts.length}件の議事録を削除しました`);
      setSelectedTranscripts([]);
      loadTranscripts();
    } catch (error) {
      console.error('一括削除エラー:', error);
      toast.error('一括削除に失敗しました');
    }
  };
  
  // 選択関連
  const toggleTranscriptSelection = (transcriptUuid: string) => {
    setSelectedTranscripts(prev => 
      prev.includes(transcriptUuid)
        ? prev.filter(id => id !== transcriptUuid)
        : [...prev, transcriptUuid]
    );
  };
  
  const toggleAllSelection = () => {
    if (selectedTranscripts.length === transcripts.length) {
      setSelectedTranscripts([]);
    } else {
      setSelectedTranscripts(transcripts.map(t => t.transcript_uuid));
    }
  };
  
  // 時間フォーマット
//  const formatDuration = (minutes: number): string => {
//    if (!minutes) return '不明';
//    const hours = Math.floor(minutes / 60);
//    const mins = minutes % 60;
//    return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
//  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <div className="dashboard-logo-icon">
              📋
            </div>
            <div>
              <h1 className="dashboard-title">議事録一覧</h1>
              <p className="dashboard-subtitle">
                {user?.role === 'admin' ? '全ユーザーの議事録' : 'あなたの議事録'}
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
            {selectedTranscripts.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="profile-logout-btn"
                style={{ marginLeft: '0.5rem' }}
              >
                選択削除 ({selectedTranscripts.length})
              </button>
            )}
            <button onClick={logout} className="dashboard-logout-btn">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* 検索・フィルターセクション */}
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">検索・フィルター</h2>
          </div>
          <div className="dashboard-section-content">
            <form onSubmit={handleSearch} className="profile-form">
              <div className="profile-form-grid">
                <div className="profile-form-group">
                  <label className="profile-form-label">検索キーワード</label>
                  <input
                    type="text"
                    placeholder="会議名や議事録内容で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="profile-form-input"
                  />
                </div>
                <div className="profile-form-group">
                  <label className="profile-form-label">期間</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="profile-form-select"
                  >
                    <option value="">全期間</option>
                    <option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]},${new Date().toISOString().split('T')[0]}`}>
                      過去7日間
                    </option>
                    <option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]},${new Date().toISOString().split('T')[0]}`}>
                      過去30日間
                    </option>
                    <option value={`${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]},${new Date().toISOString().split('T')[0]}`}>
                      今月
                    </option>
                  </select>
                </div>
                <div className="profile-form-group" style={{ alignSelf: 'end' }}>
                  <button type="submit" className="profile-form-button">
                    🔍 検索
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* 議事録一覧セクション */}
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">議事録リスト</h2>
            <button
              onClick={() => navigate('/transcripts/manual-create')}
              className="profile-form-button"
              style={{ marginLeft: 'auto' }}
            >
              ➕ 手動作成
            </button>
            {transcripts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <input
                    type="checkbox"
                    checked={selectedTranscripts.length === transcripts.length}
                    onChange={toggleAllSelection}
                    style={{ margin: 0 }}
                  />
                  全選択
                </label>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
                </span>
              </div>
            )}
          </div>
          <div className="dashboard-section-content">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '1rem', color: '#6b7280' }}>議事録を読み込んでいます...</p>
              </div>
            ) : transcripts.length > 0 ? (
              <>
                {/* 議事録カードグリッド */}
                <div className="dashboard-features">
                  {transcripts.map((transcript) => (
                    <div key={transcript.transcript_uuid} className="dashboard-feature-card">
                      <div className="dashboard-feature-header">
                        <input
                          type="checkbox"
                          checked={selectedTranscripts.includes(transcript.transcript_uuid)}
                          onChange={() => toggleTranscriptSelection(transcript.transcript_uuid)}
                          style={{ margin: '0 1rem 0 0' }}
                        />
                        <div className="dashboard-feature-icon blue">
                          📄
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 className="dashboard-feature-title">
                            {transcript.meeting_topic || 'タイトル未設定'}
                          </h3>
                          <p className="dashboard-feature-desc">
                            {transcript.summary ? 
                              transcript.summary.length > 100 ? 
                                transcript.summary.substring(0, 100) + '...' : 
                                transcript.summary
                              : '要約なし'
                            }
                          </p>
                        </div>
                      </div>
                      
                      {/* メタデータ */}
                      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                          <div>📅 {new Date(transcript.start_time).toLocaleDateString('ja-JP')} {new Date(transcript.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div>👤 {transcript.host_name || transcript.host_email || 'システム'}</div>
                          <div>🆔 {transcript.zoom_meeting_id}</div>
                          <div style={{ fontSize: '0.75rem' }}>作成: {new Date(transcript.created_at).toLocaleDateString('ja-JP')}</div>
                        </div>
                      </div>
                      
                      {/* アクションボタン */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => navigate(`/transcripts/${transcript.transcript_uuid}`)}
                          className="dashboard-feature-button blue"
                          style={{ flex: 1 }}
                        >
                          📖 詳細表示
                        </button>
                        {(user?.role === 'admin' || transcript.created_by_uuid === user?.id) && (
                          <button
                            onClick={() => handleDelete(transcript.transcript_uuid)}
                            className="dashboard-feature-button red"
                            style={{ 
                              minWidth: 'auto',
                              padding: '0.75rem',
                              width: '3rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="削除"
                          >
                            🗑️
                          </button>
                        )}
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
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 1rem' }}
                    >
                      ← 前
                    </button>
                    
                    {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className="profile-form-button"
                          style={{ 
                            minWidth: 'auto', 
                            padding: '0.5rem 1rem',
                            backgroundColor: pagination.page === page ? '#2563eb' : '#3b82f6'
                          }}
                        >
                          {page}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 1rem' }}
                    >
                      次 →
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
                  📋
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
                  {searchTerm || dateRange ? '検索結果なし' : '議事録がありません'}
                </h3>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  {searchTerm || dateRange ? 
                    '検索条件に一致する議事録が見つかりません' : 
                    'Zoom会議を録画すると、自動的に議事録が作成されます'
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

export default TranscriptsPage;
