import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// import { Button } from '../components/ui/Button';
import { toast } from 'react-hot-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success('ログインに成功しました');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">
            AI議事録システム
          </h1>
          <h2 className="login-subtitle">
            ログイン
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email" className="login-label">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder=""
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder=""
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="login-link">
          <Link to="/register">
            パスワード変更はこちら
          </Link>
        </div>

        <div className="login-demo">
          <div className="login-demo-title">デモ用アカウント:</div>
          <div className="login-demo-info">
            <div>test@example.com</div>
            <div>TestPassword123</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
