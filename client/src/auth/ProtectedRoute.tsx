import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/auth/AuthContext';

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#e8eef7,_#f7f5f1_55%)]">
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export function ProtectedRoute() {
  const { initialized, authenticated, sessionLoading, session } = useAuth();

  if (!initialized || (authenticated && sessionLoading && !session)) {
    return <LoadingScreen label="Connecting to identity provider…" />;
  }

  if (!authenticated) {
    return <Navigate to="/welcome" replace />;
  }

  if (!session || session.status === 'denied' || session.status === 'deactivated') {
    return <Navigate to="/invite/denied" replace />;
  }

  if (session.status === 'pending_acceptance') {
    return <Navigate to="/invite/accept" replace />;
  }

  return <Outlet />;
}

export function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
