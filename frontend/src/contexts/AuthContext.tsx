import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初期化時にトークンとユーザー情報をチェック
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_info');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('AuthContext - localStorage user data:', user);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // user_uuidがある場合はidとして使用、createdAtをcreated_atに変換
        if (user.user_uuid && !user.id) {
          user.id = user.user_uuid;
        }
        if (user.createdAt && !user.created_at) {
          user.created_at = user.createdAt;
        }
        
        console.log('AuthContext - processed user data:', user);
        setUser(user);
      } catch (error) {
        console.error('Failed to parse user info:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { accessToken, user } = response.data;
      console.log('AuthContext - login API response user:', user);
      
      // user_uuidをidとして使用、createdAtをcreated_atに変換
      const userWithId = {
        ...user,
        id: user.user_uuid,
        created_at: user.createdAt || user.created_at
      };
      
      console.log('AuthContext - login processed user:', userWithId);
      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('user_info', JSON.stringify(userWithId));
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      setUser(userWithId);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await api.post('/api/auth/register', { email, password, name });
      const { accessToken, user } = response.data;
      
      // user_uuidをidとして使用、createdAtをcreated_atに変換
      const userWithId = {
        ...user,
        id: user.user_uuid,
        created_at: user.createdAt || user.created_at
      };
      
      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('user_info', JSON.stringify(userWithId));
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      setUser(userWithId);
    } catch (error) {
      throw error;
    }
  };

  const updateUser = (updatedUser: User) => {
    localStorage.setItem('user_info', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    register,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};