import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';

const ProfilePage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  
  // デバッグ用：ユーザーデータをコンソールに出力
  console.log('ProfilePage user data:', user);
  
  // ユーザーデータ再読み込み関数
  const refreshUserData = async () => {
    try {
      const response = await authApi.getProfile();
      console.log('Refreshed user data from API:', response);
      const userData = response.user;
      // createdAtをcreated_atに変換
      const processedUser = {
        ...userData,
        id: userData.user_uuid,
        created_at: userData.createdAt || userData.created_at
      };
      console.log('Processed user data:', processedUser);
      updateUser(processedUser);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };
  
  // State for profile update
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email_distribution_preference: 'all' // 'all' or 'host_only'
  });
  
  // State for password change
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // ページ読み込み時にユーザーデータを確認・更新
  useEffect(() => {
    if (user && !user.created_at) {
      console.log('User data missing created_at, refreshing...');
      refreshUserData();
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);

    try {
      const response = await authApi.updateProfile(profileData);
      updateUser(response.user);
      toast.success('プロフィールが更新されました');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'プロフィールの更新に失敗しました');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('新しいパスワードが一致しません');
      return;
    }

    setIsChangingPassword(true);

    try {
      await authApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('パスワードが変更されました');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'パスワードの変更に失敗しました');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="profile">
      {/* Header */}
      <header className="profile-header">
        <div className="profile-header-content">
          <div className="profile-logo">
            <div className="profile-logo-icon">
              AI
            </div>
            <div>
              <h1 className="profile-title">プロフィール設定</h1>
              <p className="profile-subtitle">
                アカウント情報とシステム設定を管理します
              </p>
            </div>
          </div>
          <div className="profile-nav">
            <Link to="/dashboard" className="profile-nav-link">
              ダッシュボード
            </Link>
            <button onClick={handleLogout} className="profile-logout-btn">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="profile-main">
        
        {/* Account Information */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">アカウント情報</h2>
          </div>
          <div className="profile-section-content">
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <div className="profile-info-label">ユーザーID</div>
                <div className="profile-info-value">{user?.id}</div>
              </div>
              <div className="profile-info-item">
                <div className="profile-info-label">メールアドレス</div>
                <div className="profile-info-value">{user?.email}</div>
              </div>
              <div className="profile-info-item">
                <div className="profile-info-label">権限</div>
                <div>
                  <span className={`profile-role-badge ${user?.role === 'admin' ? 'admin' : 'user'}`}>
                    {user?.role === 'admin' ? '管理者' : 'ユーザー'}
                  </span>
                </div>
              </div>
              <div className="profile-info-item">
                <div className="profile-info-label">アカウント作成日</div>
                <div className="profile-info-value">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : '読み込み中...'}
                </div>
              </div>
              <div className="profile-info-item">
                <div className="profile-info-label">デバッグ</div>
                <div>
                  <button onClick={refreshUserData} style={{padding: '5px 10px', fontSize: '12px', backgroundColor: '#f0f0f0'}}>
                    ユーザーデータ再読み込み
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">基本設定</h2>
          </div>
          <div className="profile-section-content">
            <form onSubmit={handleProfileUpdate} className="profile-form">
              <div className="profile-form-grid">
                <div className="profile-form-group">
                  <label htmlFor="name" className="profile-form-label">
                    表示名
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="profile-form-input"
                    required
                  />
                </div>
                <div className="profile-form-group">
                  <label htmlFor="distribution" className="profile-form-label">
                    議事録送付設定
                  </label>
                  <select
                    id="distribution"
                    value={profileData.email_distribution_preference}
                    onChange={(e) => setProfileData({ ...profileData, email_distribution_preference: e.target.value })}
                    className="profile-form-select"
                  >
                    <option value="all">全参加者に送付</option>
                    <option value="host_only">ホストのみに送付</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="profile-form-button"
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? '更新中...' : '設定を保存'}
              </button>
            </form>
          </div>
        </div>

        {/* Password Change */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">パスワード変更</h2>
          </div>
          <div className="profile-section-content">
            <form onSubmit={handlePasswordChange} className="profile-form">
              <div className="profile-password-section">
                <div className="profile-form-group">
                  <label htmlFor="currentPassword" className="profile-form-label">
                    現在のパスワード
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="profile-form-input"
                    required
                  />
                </div>
                <div className="profile-form-group">
                  <label htmlFor="newPassword" className="profile-form-label">
                    新しいパスワード
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="profile-form-input"
                    required
                  />
                  <div className="profile-form-help">
                    8文字以上で、大文字・小文字・数字を含む必要があります
                  </div>
                </div>
                <div className="profile-form-group">
                  <label htmlFor="confirmPassword" className="profile-form-label">
                    新しいパスワード（確認）
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="profile-form-input"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="profile-form-button"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? '変更中...' : 'パスワードを変更'}
              </button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
};

export default ProfilePage;