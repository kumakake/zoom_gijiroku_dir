import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Pages
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import TranscriptsPage from '../pages/TranscriptsPage';
import TranscriptDetailPage from '../pages/TranscriptDetailPage';
import ManualTranscriptPage from '../pages/ManualTranscriptPage';
import JobsPage from '../pages/JobsPage';
import JobDetailPage from '../pages/JobDetailPage';
import SettingsPage from '../pages/SettingsPage';
import ProfilePage from '../pages/ProfilePage';
import UploadPage from '../pages/UploadPage';
import DebugPage from '../pages/DebugPage';
import { TenantsPage } from '../pages/TenantsPage';
import { TenantAdminPage } from '../pages/TenantAdminPage';
import { TranscriptFormatPage } from '../pages/TranscriptFormatPage';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  console.log('🔒 ProtectedRoute:', { user: !!user, isLoading });
  
  if (isLoading) {
    console.log('🔒 ProtectedRoute: Loading...');
    return <LoadingSpinner />;
  }
  
  if (!user) {
    console.log('🔒 ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  console.log('🔒 ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};

// Admin Only Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Tenant Admin Only Route Component
const TenantAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role !== 'tenant_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Public Route Component (redirect to dashboard if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

export const AppRouter = () => {
  const location = useLocation();
  console.log('🚦 AppRouter レンダリング, 現在のパス:', location.pathname);
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <RegisterPage />
        </PublicRoute>
      } />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/transcripts" element={
        <ProtectedRoute>
          <TranscriptsPage />
        </ProtectedRoute>
      } />
      <Route path="/transcripts/manual-create" element={
        <ProtectedRoute>
          <ManualTranscriptPage />
        </ProtectedRoute>
      } />
      <Route path="/transcripts/:id" element={
        <ProtectedRoute>
          <TranscriptDetailPage />
        </ProtectedRoute>
      } />
      {/* Jobs routes - 開発環境でのみ有効 */}
      {import.meta.env.VITE_SHOW_JOB_STATUS === 'true' && (
        <>
          <Route path="/jobs" element={
            <ProtectedRoute>
              <JobsPage />
            </ProtectedRoute>
          } />
          <Route path="/jobs/:id" element={
            <ProtectedRoute>
              <JobDetailPage />
            </ProtectedRoute>
          } />
        </>
      )}
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/upload" element={
        <ProtectedRoute>
          <UploadPage />
        </ProtectedRoute>
      } />
      <Route path="/debug" element={
        <ProtectedRoute>
          <DebugPage />
        </ProtectedRoute>
      } />
      
      {/* Admin Only Routes */}
      <Route path="/admin/tenants" element={
        <AdminRoute>
          <TenantsPage />
        </AdminRoute>
      } />
      
      {/* Tenant Admin Only Routes */}
      <Route path="/tenant-admin" element={
        <TenantAdminRoute>
          <TenantAdminPage />
        </TenantAdminRoute>
      } />
      <Route path="/transcript-formats" element={
        <ProtectedRoute>
          <TranscriptFormatPage />
        </ProtectedRoute>
      } />
      <Route path="/transcript-formats/new" element={
        <ProtectedRoute>
          {console.log('🚦 TranscriptFormatPage (new) ルート実行')}
          <TranscriptFormatPage />
        </ProtectedRoute>
      } />
      <Route path="/transcript-formats/edit/:id" element={
        <ProtectedRoute>
          <TranscriptFormatPage />
        </ProtectedRoute>
      } />
      
      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};