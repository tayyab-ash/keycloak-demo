import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from '@/auth/AuthContext';
import { ProtectedRoute, SuperAdminRoute } from '@/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/toast';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InviteAcceptPage } from '@/pages/InviteAcceptPage';
import { InviteDeniedPage } from '@/pages/InviteDeniedPage';
import { SessionInfoPage } from '@/pages/SessionInfoPage';
import { UsersPage } from '@/pages/UsersPage';
import { WelcomePage } from '@/pages/WelcomePage';

export default function App() {
  return (
    <AuthProvider>
      <Toaster>
        <BrowserRouter>
          <Routes>
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/invite/accept" element={<InviteAcceptPage />} />
            <Route path="/invite/denied" element={<InviteDeniedPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/api-keys" element={<ApiKeysPage />} />
                <Route path="/session" element={<SessionInfoPage />} />
                <Route path="/403" element={<AccessDeniedPage />} />
                <Route element={<SuperAdminRoute />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </Toaster>
    </AuthProvider>
  );
}
