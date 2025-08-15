import React, { useState, useEffect } from 'react';
import { tenantAdminApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Bug, ArrowLeft, Users, BarChart3, Calendar } from 'lucide-react';

interface TenantInfo {
  tenant_id: string;
  name: string;
  admin_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats: {
    user_count: number;
    job_count: number;
    transcript_count: number;
  };
}

interface ZoomSettings {
  tenant_id: string;
  zoom_account_id: string | null;
  zoom_client_id: string | null;
  client_id_status: 'configured' | 'not_configured';
  client_secret_status: 'configured' | 'not_configured';
  webhook_secret_status: 'configured' | 'not_configured';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const TenantAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [zoomSettings, setZoomSettings] = useState<ZoomSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState(false);
  const [editingZoom, setEditingZoom] = useState(false);

  // フォームデータ
  const [tenantForm, setTenantForm] = useState({
    name: '',
    admin_email: ''
  });

  const [zoomForm, setZoomForm] = useState({
    zoom_account_id: '',
    zoom_client_id: '',
    zoom_client_secret: '',
    zoom_webhook_secret: ''
  });

  // データ読み込み
  const loadData = async () => {
    try {
      setLoading(true);
      const [tenantResponse, zoomResponse] = await Promise.all([
        tenantAdminApi.getTenant(),
        tenantAdminApi.getZoomSettings()
      ]);
      
      setTenant(tenantResponse.tenant);
      setZoomSettings(zoomResponse.settings);
      
      // フォームの初期値設定
      if (tenantResponse.tenant) {
        setTenantForm({
          name: tenantResponse.tenant.name,
          admin_email: tenantResponse.tenant.admin_email
        });
      }
      
      if (zoomResponse.settings) {
        setZoomForm({
          zoom_account_id: zoomResponse.settings.zoom_account_id || '',
          zoom_client_id: zoomResponse.settings.zoom_client_id || '',
          zoom_client_secret: '',
          zoom_webhook_secret: ''
        });
      }
      
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      toast.error('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // テナント情報更新
  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await tenantAdminApi.updateTenant(tenantForm);
      setTenant(response.tenant);
      setEditingTenant(false);
      toast.success('テナント情報を更新しました');
    } catch (error) {
      console.error('テナント更新エラー:', error);
      toast.error('テナント情報の更新に失敗しました');
    }
  };

  // Zoom設定更新
  const handleUpdateZoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 空の値は送信しない
      const updateData = Object.entries(zoomForm).reduce((acc, [key, value]) => {
        if (value.trim() !== '') {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
      
      await tenantAdminApi.updateZoomSettings(updateData);
      await loadData(); // 設定を再読み込み
      setEditingZoom(false);
      toast.success('Zoom設定を更新しました');
    } catch (error) {
      console.error('Zoom設定更新エラー:', error);
      toast.error('Zoom設定の更新に失敗しました');
    }
  };

  // ダッシュボードに戻る処理
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  // デバッグダッシュボードに移動
  const handleDebugDashboard = () => {
    navigate('/debug');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        <div>テナント情報が見つかりません</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
          テナント管理
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleDebugDashboard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Bug style={{ width: '1rem', height: '1rem' }} />
            デバッグダッシュボード
          </button>
          <button
            onClick={handleBackToDashboard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
            ダッシュボードに戻る
          </button>
        </div>
      </div>

      {/* 統計カード */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="login-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <Users style={{ width: '1.5rem', height: '1.5rem', color: '#3b82f6', marginRight: '0.5rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>ユーザー数</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            {tenant.stats.user_count}
          </p>
        </div>

        <div className="login-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <BarChart3 style={{ width: '1.5rem', height: '1.5rem', color: '#10b981', marginRight: '0.5rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>処理ジョブ数</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            {tenant.stats.job_count}
          </p>
        </div>

        <div className="login-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <Calendar style={{ width: '1.5rem', height: '1.5rem', color: '#f59e0b', marginRight: '0.5rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>議事録数</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            {tenant.stats.transcript_count}
          </p>
        </div>
      </div>

      {/* テナント基本情報とZoom設定を横並びに配置 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* テナント基本情報 */}
        <div className="login-card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>テナント基本情報</h2>
            <button
              onClick={() => setEditingTenant(!editingTenant)}
              style={{
                backgroundColor: editingTenant ? '#6b7280' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              {editingTenant ? 'キャンセル' : '編集'}
            </button>
          </div>

        {editingTenant ? (
          <form onSubmit={handleUpdateTenant}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                テナント名
              </label>
              <input
                type="text"
                value={tenantForm.name}
                onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                className="login-input"
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                管理者メールアドレス
              </label>
              <input
                type="email"
                value={tenantForm.admin_email}
                onChange={(e) => setTenantForm({ ...tenantForm, admin_email: e.target.value })}
                className="login-input"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                更新
              </button>
              <button
                type="button"
                onClick={() => setEditingTenant(false)}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>テナントID:</strong> {tenant.tenant_id}
            </div>
            <div>
              <strong>テナント名:</strong> {tenant.name}
            </div>
            <div>
              <strong>管理者メールアドレス:</strong> {tenant.admin_email}
            </div>
            <div>
              <strong>作成日:</strong> {new Date(tenant.created_at).toLocaleDateString('ja-JP')}
            </div>
            <div>
              <strong>Webhook URL:</strong><br />
			  <span>
			    &ensp;https://zm01.ast-tools.online/api/webhooks<br />
                &ensp;/zoom/{tenant.tenant_id}
			  </span>
            </div>
          </div>
        )}
        </div>

        {/* Zoom設定 */}
        <div className="login-card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Zoom設定</h2>
          <button
            onClick={() => setEditingZoom(!editingZoom)}
            style={{
              backgroundColor: editingZoom ? '#6b7280' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            {editingZoom ? 'キャンセル' : '編集'}
          </button>
        </div>

        {editingZoom ? (
          <form onSubmit={handleUpdateZoom}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Zoom Account ID
                </label>
                <input
                  type="text"
                  value={zoomForm.zoom_account_id}
                  onChange={(e) => setZoomForm({ ...zoomForm, zoom_account_id: e.target.value })}
                  className="login-input"
                  placeholder="Account ID を入力"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Client ID
                </label>
                <input
                  type="text"
                  value={zoomForm.zoom_client_id}
                  onChange={(e) => setZoomForm({ ...zoomForm, zoom_client_id: e.target.value })}
                  className="login-input"
                  placeholder="Client IDを入力"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Client Secret
                </label>
                <input
                  type="password"
                  value={zoomForm.zoom_client_secret}
                  onChange={(e) => setZoomForm({ ...zoomForm, zoom_client_secret: e.target.value })}
                  className="login-input"
                  placeholder={zoomSettings?.client_secret_status === 'configured' ? '***' : 'Client Secretを入力'}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Webhook Secret
                </label>
                <input
                  type="password"
                  value={zoomForm.zoom_webhook_secret}
                  onChange={(e) => setZoomForm({ ...zoomForm, zoom_webhook_secret: e.target.value })}
                  className="login-input"
                  placeholder={zoomSettings?.webhook_secret_status === 'configured' ? '***' : 'Webhook Secretを入力'}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                更新
              </button>
              <button
                type="button"
                onClick={() => setEditingZoom(false)}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <div>
            {zoomSettings ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Account ID:</strong> {zoomSettings.zoom_account_id || '未設定'}
                </div>
                <div>
                  <strong>Client ID:</strong> {zoomSettings.zoom_client_id || '未設定'}
                </div>
                <div>
                  <strong>Client Secret:</strong>
                  <span style={{ 
                    color: zoomSettings.client_secret_status === 'configured' ? '#10b981' : '#ef4444',
                    marginLeft: '0.5rem'
                  }}>
                    {zoomSettings.client_secret_status === 'configured' ? '設定済み' : '未設定'}
                  </span>
                </div>
                <div>
                  <strong>Webhook Secret:</strong>
                  <span style={{ 
                    color: zoomSettings.webhook_secret_status === 'configured' ? '#10b981' : '#ef4444',
                    marginLeft: '0.5rem'
                  }}>
                    {zoomSettings.webhook_secret_status === 'configured' ? '設定済み' : '未設定'}
                  </span>
                </div>

                <div>
                  <strong>■Zoom イベント</strong>
                </div>
                <div>
                  <strong>Meeting:</strong><span>End Meeting</span>
                </div>
                <div>
                  <strong>Recording:</strong><br />
				  <span>&emsp;All Recordings have completed</span><br />
				  <span>&emsp;Recording Transcript files have completed</span>
                </div>

                <div>
                  <strong>■Zoom スコープ</strong>
                </div>
                <div>
                  <strong>Meeting:</strong><br />
				  <span>meeting:read:meeting:admin ( View a meeting ) </span>
                </div>
                <div>
                  <strong>Recording:</strong><br />
				  <span>cloud_recording:read:recording:admin<br />　( View a recording ) </span><br />
				  <span>cloud_recording:read:list_recording_files:admin<br />　( Returns all of a meeting's recordings. )</span>
                </div>
                <div>
                  <strong>Report:</strong><br />
				  <span>report:read:list_meeting_participants:admin<br />　( View meeting participant reports )</span>
                </div>
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>Zoom設定が登録されていません</p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
