import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './router/AppRouter';

function App() {
  console.log('📱 App コンポーネント レンダリング');
  // React Queryクライアントの設定
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000, // 5分
        gcTime: 10 * 60 * 1000, // 10分
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {console.log('📱 AuthProvider内部でAppRouter呼び出し')}
          <AppRouter />
          
          {/* Toast通知の設定 */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: 'text-sm',
              success: {
                style: {
                  background: '#10b981',
                  color: 'white',
                },
                iconTheme: {
                  primary: 'white',
                  secondary: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                  color: 'white',
                },
                iconTheme: {
                  primary: 'white',
                  secondary: '#ef4444',
                },
              },
              loading: {
                style: {
                  background: '#3b82f6',
                  color: 'white',
                },
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;