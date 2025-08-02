import { useState, useEffect } from 'react';
import { transcriptApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from './ui/LoadingSpinner';

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

interface DistributionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptId: string;
}

const DistributionHistoryModal = ({ isOpen, onClose, transcriptId }: DistributionHistoryModalProps) => {
  const [distributionHistory, setDistributionHistory] = useState<DistributionHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<DistributionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // データ取得
  const loadDistributionHistory = async () => {
    if (!transcriptId) return;
    
    try {
      setLoading(true);
      const response = await transcriptApi.getDistributionHistory(transcriptId);
      setDistributionHistory(response.distribution_history || []);
    } catch (error) {
      console.error('配布履歴の取得に失敗:', error);
      toast.error('配布履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // モーダルが開かれた時にデータ取得
  useEffect(() => {
    if (isOpen) {
      loadDistributionHistory();
      setSearchTerm('');
      setStatusFilter('all');
      setCurrentPage(1);
    }
  }, [isOpen, transcriptId]);

  // フィルタリング処理
  useEffect(() => {
    let filtered = distributionHistory;

    // 検索フィルタ
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.display_recipient.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // ステータスフィルタ
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    setFilteredHistory(filtered);
    setCurrentPage(1); // フィルタ変更時はページを1に戻す
  }, [distributionHistory, searchTerm, statusFilter]);

  // ページネーション
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ステータスの表示用変換
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'sent': return { text: '送信済み', color: '#059669', icon: '✅' };
      case 'failed': return { text: '送信失敗', color: '#dc2626', icon: '❌' };
      case 'pending': return { text: '送信中', color: '#d97706', icon: '⏳' };
      default: return { text: status, color: '#6b7280', icon: '❓' };
    }
  };

  // 日時フォーマット
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* ヘッダー */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            margin: 0,
            color: '#1f2937'
          }}>
            📧 メール配布履歴
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem'
            }}
          >
            ×
          </button>
        </div>

        {/* 検索・フィルタ */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="メールアドレスで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                backgroundColor: 'white'
              }}
            >
              <option value="all">全てのステータス</option>
              <option value="sent">送信済み</option>
              <option value="failed">送信失敗</option>
              <option value="pending">送信中</option>
            </select>
          </div>
        </div>

        {/* 統計情報 */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#f9fafb',
          display: 'flex',
          gap: '2rem',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          <span>総件数: <strong>{distributionHistory.length}</strong></span>
          <span>表示中: <strong>{filteredHistory.length}</strong></span>
          <span>送信済み: <strong>{distributionHistory.filter(h => h.status === 'sent').length}</strong></span>
          <span>失敗: <strong>{distributionHistory.filter(h => h.status === 'failed').length}</strong></span>
        </div>

        {/* コンテンツ */}
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '0'
        }}>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '200px' 
            }}>
              <LoadingSpinner />
            </div>
          ) : paginatedHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              color: '#6b7280'
            }}>
              {filteredHistory.length === 0 && distributionHistory.length > 0 
                ? '検索条件に一致する履歴がありません' 
                : '配布履歴がありません'
              }
            </div>
          ) : (
            <div>
              {paginatedHistory.map((item, index) => {
                const statusDisplay = getStatusDisplay(item.status);
                return (
                  <div
                    key={item.log_uuid}
                    style={{
                      padding: '1rem 1.5rem',
                      borderBottom: index < paginatedHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '500',
                        marginBottom: '0.25rem',
                        color: '#1f2937'
                      }}>
                        {item.display_recipient}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        marginBottom: '0.25rem'
                      }}>
                        作成: {formatDateTime(item.created_at)}
                        {item.sent_at && (
                          <> | 送信: {formatDateTime(item.sent_at)}</>
                        )}
                      </div>
                      {item.error_message && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#dc2626',
                          backgroundColor: '#fef2f2',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          marginTop: '0.25rem'
                        }}>
                          エラー: {item.error_message}
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginLeft: '1rem'
                    }}>
                      <span style={{ fontSize: '1rem' }}>{statusDisplay.icon}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: statusDisplay.color,
                        whiteSpace: 'nowrap'
                      }}>
                        {statusDisplay.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {filteredHistory.length}件中 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredHistory.length)}件を表示
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                  color: currentPage === 1 ? '#9ca3af' : '#374151',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                前へ
              </button>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 1rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                  color: currentPage === totalPages ? '#9ca3af' : '#374151',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistributionHistoryModal;