import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { agentApi, transcriptApi } from '../lib/api';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    transcriptCount: '-',
    activeJobs: '-',
    distributedEmails: '-',
    loading: true
  });

  // システム統計データを取得
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true }));
        
        // 並列でAPI呼び出し
        const [agentStatsResponse, transcriptStatsResponse] = await Promise.all([
          agentApi.getStats().catch(err => {
            console.error('Agent stats error:', err);
            return { data: { stats: { processing_jobs: 0, pending_jobs: 0 } } };
          }),
          transcriptApi.getStats().catch(err => {
            console.error('Transcript stats error:', err);
            return { data: { total: 0, distributed_emails: 0 } };
          })
        ]);

        console.log('Agent stats response:', agentStatsResponse);
        console.log('Transcript stats response:', transcriptStatsResponse);

        const agentStats = agentStatsResponse.data?.stats || agentStatsResponse.stats || {};
        const transcriptStats = transcriptStatsResponse.data || transcriptStatsResponse;

        setStats({
          transcriptCount: transcriptStats.total || 0,
          activeJobs: (agentStats.processing_jobs || 0) + (agentStats.pending_jobs || 0),
          distributedEmails: transcriptStats.distributed_emails || 0,
          loading: false
        });

      } catch (error) {
        console.error('統計データ取得エラー:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  const features = [
    {
      title: '議事録一覧',
      description: '作成された議事録を確認・編集',
      icon: '📋',
      color: 'blue',
      link: '/transcripts',
      buttonText: '議事録を見る'
    },
    // ジョブ状況は開発環境でのみ表示
    ...(import.meta.env.VITE_SHOW_JOB_STATUS === 'true' ? [{
      title: 'ジョブ状況',
      description: '処理中のタスクを監視',
      icon: '⚙️',
      color: 'green',
      link: '/jobs',
      buttonText: 'ジョブを見る'
    }] : []),
    {
      title: 'ファイルアップロード',
      description: '音声ファイルの手動アップロード',
      icon: '📤',
      color: 'purple',
      link: '/upload',
      buttonText: 'アップロード'
    },
    {
      title: 'システム設定',
      description: 'AI エージェントの設定管理',
      icon: '⚡',
      color: 'orange',
      link: '/settings',
      buttonText: '設定を開く'
    }
  ];

  // 管理者のみ表示される機能
  const adminFeatures = user?.role === 'admin' ? [
    {
      title: 'テナント管理',
      description: 'マルチテナント環境の管理',
      icon: '🏢',
      color: 'indigo',
      link: '/admin/tenants',
      buttonText: 'テナント管理'
    },
    {
      title: 'デバッグ',
      description: 'システム監視とテスト機能',
      icon: '🐛',
      color: 'red',
      link: '/debug',
      buttonText: 'デバッグを開く'
    }
  ] : [];

  // テナント管理者のみ表示される機能
  const tenantAdminFeatures = user?.role === 'tenant_admin' ? [
    {
      title: 'テナント設定',
      description: '自分のテナントの設定とZoom連携',
      icon: '⚙️',
      color: 'indigo',
      link: '/tenant-admin',
      buttonText: 'テナント設定'
    }
  ] : [];

  const allFeatures = [...features, ...adminFeatures, ...tenantAdminFeatures];

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <div className="dashboard-logo-icon">
              AI
            </div>
            <div>
              <h1 className="dashboard-title">
                AI議事録システム
              </h1>
              <p className="dashboard-subtitle">
                ようこそ、{user?.name}さん
              </p>
            </div>
          </div>
          <div className="dashboard-nav">
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
        {/* Welcome Section */}
        <div className="dashboard-welcome">
          <h2 className="dashboard-welcome-title">
            Zoom議事録自動配布システム
          </h2>
          <p className="dashboard-welcome-desc">
            AI が自動で議事録を生成し、関係者に配布します
          </p>
        </div>

        {/* Feature Cards */}
        <div className="dashboard-features">
          {allFeatures.map((feature, index) => (
            <div key={index} className="dashboard-feature-card">
              <div className="dashboard-feature-header">
                <div className={`dashboard-feature-icon ${feature.color}`}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="dashboard-feature-title">
                    {feature.title}
                  </h3>
                  <p className="dashboard-feature-desc">
                    {feature.description}
                  </p>
                </div>
              </div>
              <Link to={feature.link} className={`dashboard-feature-button ${feature.color}`}>
                {feature.buttonText}
              </Link>
            </div>
          ))}
        </div>

        {/* Stats Section - 開発環境でのみ表示 */}
        {import.meta.env.VITE_SHOW_SYSTEM_STATUS === 'true' && (
          <div className="dashboard-stats">
            <h3 className="dashboard-stats-title">システム状況</h3>
            <div className="dashboard-stats-grid">
              <div className="dashboard-stat-card blue">
                <div className="dashboard-stat-value blue">
                  {stats.loading ? '...' : stats.transcriptCount}
                </div>
                <div className="dashboard-stat-label">処理済み議事録</div>
              </div>
              <div className="dashboard-stat-card green">
                <div className="dashboard-stat-value green">
                  {stats.loading ? '...' : stats.activeJobs}
                </div>
                <div className="dashboard-stat-label">実行中ジョブ</div>
              </div>
              <div className="dashboard-stat-card purple">
                <div className="dashboard-stat-value purple">
                  {stats.loading ? '...' : stats.distributedEmails}
                </div>
                <div className="dashboard-stat-label">配布済みメール</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;