import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { transcriptApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface ActionItem {
  id?: string;
  task: string;
  assignee: string;
  deadline?: string;
  due_date?: string;
  completed?: boolean;
}

interface DistributionHistory {
  log_uuid: string;
  recipient_type: string;
  recipient_id: string;
  display_recipient: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface TranscriptDetail {
  transcript_uuid: string;
  zoom_meeting_id: string;
  meeting_topic: string;
  start_time: string;
  duration: number;
  participants: any[];
  raw_transcript: string;
  formatted_transcript: string;
  summary: string;
  action_items: ActionItem[];
  created_at: string;
  created_by_uuid: string;
  created_by_name: string;
  created_by_email: string;
  host_email: string;
  host_name: string;
}

const TranscriptDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // State管理
  const [transcript, setTranscript] = useState<TranscriptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDistributionHistory, setShowDistributionHistory] = useState(false);
  const [distributionHistory, setDistributionHistory] = useState<DistributionHistory[]>([]);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [editData, setEditData] = useState({
    formatted_transcript: '',
    summary: '',
    action_items: [] as ActionItem[]
  });
  
  // データ取得
  const loadTranscript = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await transcriptApi.getTranscript(id);
      setTranscript(response.transcript);
      
      // 編集データを初期化
      setEditData({
        formatted_transcript: response.transcript.formatted_transcript || '',
        summary: response.transcript.summary || '',
        action_items: response.transcript.action_items || []
      });
    } catch (error) {
      console.error('議事録詳細の取得に失敗:', error);
      toast.error('議事録詳細の取得に失敗しました');
      navigate('/transcripts');
    } finally {
      setLoading(false);
    }
  };
  
  // 配布履歴取得
  const loadDistributionHistory = async () => {
    if (!id) return;
    
    try {
      setDistributionLoading(true);
      const response = await transcriptApi.getDistributionHistory(id);
      setDistributionHistory(response.distribution_history || []);
    } catch (error) {
      console.error('配布履歴の取得に失敗:', error);
      toast.error('配布履歴の取得に失敗しました');
    } finally {
      setDistributionLoading(false);
    }
  };
  
  // 配布履歴表示の切り替え
  const toggleDistributionHistory = () => {
    if (!showDistributionHistory) {
      loadDistributionHistory();
    }
    setShowDistributionHistory(!showDistributionHistory);
  };
  
  // 初期データ読み込み
  useEffect(() => {
    loadTranscript();
  }, [id]);
  
  // 保存処理
  const handleSave = async () => {
    if (!transcript) return;
    
    try {
      const response = await transcriptApi.updateTranscript(transcript.transcript_uuid, editData);
      setTranscript(response.transcript);
      setIsEditing(false);
      toast.success('議事録を更新しました');
    } catch (error) {
      console.error('議事録の更新に失敗:', error);
      toast.error('議事録の更新に失敗しました');
    }
  };
  
  // 削除処理
  const handleDelete = async () => {
    if (!transcript) return;
    
    if (!confirm(`議事録「${transcript.meeting_topic}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    
    try {
      await transcriptApi.deleteTranscript(transcript.transcript_uuid);
      toast.success('議事録を削除しました');
      navigate('/transcripts');
    } catch (error) {
      console.error('議事録の削除に失敗:', error);
      toast.error('議事録の削除に失敗しました');
    }
  };
  
  // アクションアイテム関連
  const addActionItem = () => {
    setEditData(prev => ({
      ...prev,
      action_items: [...prev.action_items, { task: '', assignee: '', deadline: '' }]
    }));
  };
  
  const updateActionItem = (index: number, field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      action_items: prev.action_items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };
  
  const removeActionItem = (index: number) => {
    setEditData(prev => ({
      ...prev,
      action_items: prev.action_items.filter((_, i) => i !== index)
    }));
  };
  
  // 権限チェック
  const canEdit = () => {
    return user?.role === 'admin' || transcript?.created_by_uuid === user?.id;
  };
  
  // 時間フォーマット
  const formatDuration = (minutes: number): string => {
    if (!minutes) return '不明';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
  };
  
  // 参加者フォーマット
  const formatParticipants = (participants: any[]) => {
    if (!participants || participants.length === 0) return [];
    return participants.map((p, i) => p.name || p.email || `参加者${i + 1}`);
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
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>議事録を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!transcript) {
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
              議事録が見つかりません
            </h3>
            <button
              onClick={() => navigate('/transcripts')}
              className="profile-form-button"
            >
              ← 議事録一覧に戻る
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
              📄
            </div>
            <div>
              <h1 className="dashboard-title">
                {transcript.meeting_topic || 'タイトル未設定'}
              </h1>
              <p className="dashboard-subtitle">
                {new Date(transcript.start_time).toLocaleDateString('ja-JP')} • {formatDuration(transcript.duration)}
              </p>
            </div>
          </div>
          <div className="dashboard-nav">
            <Link to="/transcripts" className="dashboard-nav-link">
              ← 議事録一覧
            </Link>
            <Link to="/profile" className="dashboard-nav-link">
              プロフィール
            </Link>
            {canEdit() && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="dashboard-logout-btn"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSave}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 1rem' }}
                    >
                      💾 保存
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="profile-form-button"
                      style={{ minWidth: 'auto', padding: '0.5rem 1rem' }}
                    >
                      ✏️ 編集
                    </button>
                    <button
                      onClick={toggleDistributionHistory}
                      className="profile-form-button"
                      style={{ 
                        minWidth: 'auto', 
                        padding: '0.5rem 1rem',
                        backgroundColor: showDistributionHistory ? '#059669' : '#0f766e'
                      }}
                    >
                      📧 配布履歴
                    </button>
                    <button
                      onClick={handleDelete}
                      className="profile-logout-btn"
                    >
                      🗑️ 削除
                    </button>
                  </>
                )}
              </>
            )}
            <button onClick={logout} className="dashboard-logout-btn">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* 会議情報セクション */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">📋 会議情報</h2>
          </div>
          <div className="profile-section-content">
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">📅 開催日時</span>
                <div className="profile-info-value">
                  {new Date(transcript.start_time).toLocaleString('ja-JP')}
                </div>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">🆔 会議ID</span>
                <div className="profile-info-value">
                  {transcript.zoom_meeting_id}
                </div>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">👤 ホスト</span>
                <div className="profile-info-value">
                  {transcript.host_name || transcript.host_email || 'システム'}
                </div>
              </div>
            </div>

            {transcript.participants && transcript.participants.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <span className="profile-info-label">👥 参加者 ({transcript.participants.length}名)</span>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem', 
                  marginTop: '0.5rem' 
                }}>
                  {formatParticipants(transcript.participants).map((name, index) => (
                    <span
                      key={index}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af'
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 要約セクション */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">📝 要約</h2>
          </div>
          <div className="profile-section-content">
            {isEditing ? (
              <div className="profile-form-group">
                <textarea
                  value={editData.summary}
                  onChange={(e) => setEditData(prev => ({ ...prev, summary: e.target.value }))}
                  className="profile-form-input"
                  rows={6}
                  placeholder="会議の要約を入力してください..."
                />
              </div>
            ) : (
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#f8fafc', 
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6
              }}>
                {transcript.summary || (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    要約がありません
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* アクションアイテムセクション */}
        <div className="profile-section">
          <div className="profile-section-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="profile-section-title">✅ アクションアイテム</h2>
              {isEditing && (
                <button
                  onClick={addActionItem}
                  className="profile-form-button"
                  style={{ minWidth: 'auto', padding: '0.5rem 1rem' }}
                >
                  ➕ 追加
                </button>
              )}
            </div>
          </div>
          <div className="profile-section-content">
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {editData.action_items.map((item, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '0.5rem', 
                      padding: '1rem',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <div className="profile-form-grid">
                      <div className="profile-form-group">
                        <label className="profile-form-label">タスク内容</label>
                        <textarea
                          value={item.task || ''}
                          onChange={(e) => updateActionItem(index, 'task', e.target.value)}
                          className="profile-form-input"
                          rows={2}
                          placeholder="タスクの詳細..."
                        />
                      </div>
                      <div className="profile-form-group">
                        <label className="profile-form-label">担当者</label>
                        <input
                          type="text"
                          value={item.assignee || ''}
                          onChange={(e) => updateActionItem(index, 'assignee', e.target.value)}
                          className="profile-form-input"
                          placeholder="担当者名"
                        />
                      </div>
                      <div className="profile-form-group">
                        <label className="profile-form-label">期限</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="date"
                            value={item.deadline || item.due_date || ''}
                            onChange={(e) => updateActionItem(index, 'deadline', e.target.value)}
                            className="profile-form-input"
                            style={{ flex: 1 }}
                          />
                          <button
                            onClick={() => removeActionItem(index)}
                            className="profile-logout-btn"
                            style={{ minWidth: 'auto', padding: '0.5rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {editData.action_items.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem', 
                    color: '#6b7280',
                    fontStyle: 'italic'
                  }}>
                    アクションアイテムがありません。「追加」ボタンで新しいアイテムを作成してください。
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {transcript.action_items && transcript.action_items.length > 0 ? (
                  transcript.action_items.map((item, index) => (
                    <div 
                      key={index} 
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '0.5rem', 
                        padding: '1rem',
                        backgroundColor: '#f8fafc'
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                            📋 タスク:
                          </span>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#1f2937' }}>
                            {item.task || '未設定'}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                            👤 担当者:
                          </span>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#1f2937' }}>
                            {item.assignee || '未設定'}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                            📅 期限:
                          </span>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#1f2937' }}>
                            {(item.deadline || item.due_date) 
                              ? new Date(item.deadline || item.due_date!).toLocaleDateString('ja-JP') 
                              : '未設定'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem', 
                    color: '#6b7280',
                    fontStyle: 'italic'
                  }}>
                    アクションアイテムがありません
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 議事録本文セクション */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">📄 議事録</h2>
          </div>
          <div className="profile-section-content">
            {isEditing ? (
              <div className="profile-form-group">
                <textarea
                  value={editData.formatted_transcript}
                  onChange={(e) => setEditData(prev => ({ ...prev, formatted_transcript: e.target.value }))}
                  className="profile-form-input"
                  rows={24}
                  placeholder="議事録の内容を入力してください..."
                  style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
              </div>
            ) : (
              <div style={{ 
                padding: '1.5rem', 
                backgroundColor: '#f8fafc', 
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                maxHeight: '600px',
                overflow: 'auto'
              }}>
                {transcript.formatted_transcript ? (
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '0.875rem', 
                    color: '#1f2937',
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {transcript.formatted_transcript}
                  </pre>
                ) : transcript.raw_transcript ? (
                  <div>
                    <p style={{ 
                      color: '#6b7280', 
                      fontStyle: 'italic', 
                      marginBottom: '1rem',
                      fontSize: '0.875rem'
                    }}>
                      整形された議事録がありません。以下は生の文字起こしです:
                    </p>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      fontSize: '0.75rem', 
                      color: '#4b5563',
                      fontFamily: 'monospace',
                      backgroundColor: '#f3f4f6',
                      padding: '1rem',
                      borderRadius: '0.375rem',
                      margin: 0
                    }}>
                      {transcript.raw_transcript}
                    </pre>
                  </div>
                ) : (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    議事録データがありません
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 配布履歴セクション */}
        {showDistributionHistory && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f8fafc',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#1e293b'
            }}>
              📧 メール配布履歴
            </h3>
            
            {distributionLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '0.5rem', color: '#64748b' }}>配布履歴を読み込み中...</p>
              </div>
            ) : distributionHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>
                配布履歴がありません
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e2e8f0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>配布先</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>種別</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>ステータス</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>送信日時</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>エラー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionHistory.map((log) => (
                      <tr key={log.log_uuid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem' }}>{log.display_recipient}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            backgroundColor: log.recipient_type === 'email' ? '#dbeafe' : '#fef3c7',
                            color: log.recipient_type === 'email' ? '#1e40af' : '#92400e'
                          }}>
                            {log.recipient_type === 'email' ? 'メール' : log.recipient_type}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            backgroundColor: log.status === 'sent' ? '#dcfce7' : 
                                           log.status === 'failed' ? '#fecaca' : '#fef3c7',
                            color: log.status === 'sent' ? '#166534' : 
                                   log.status === 'failed' ? '#dc2626' : '#92400e'
                          }}>
                            {log.status === 'sent' ? '送信済み' : 
                             log.status === 'failed' ? '失敗' : 
                             log.status === 'pending' ? '待機中' : log.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {log.sent_at ? new Date(log.sent_at).toLocaleString('ja-JP') : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#dc2626', fontSize: '0.75rem' }}>
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 作成情報 */}
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
          🕒 作成日時: {new Date(transcript.created_at).toLocaleString('ja-JP')}
          {transcript.created_by_name && (
            <> • 👤 作成者: {transcript.created_by_name}</>
          )}
        </div>
      </main>
    </div>
  );
};

export default TranscriptDetailPage;
