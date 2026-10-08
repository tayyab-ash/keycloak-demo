import { Navigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';

export function WelcomePage() {
  const { initialized, authenticated, session, sessionLoading, login } = useAuth();

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)]">
        <div className="text-sm text-muted-foreground">Connecting to identity provider…</div>
      </div>
    );
  }

  if (authenticated) {
    if (sessionLoading && !session) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)]">
          <div className="text-sm text-muted-foreground">Checking your invitation…</div>
        </div>
      );
    }
    if (session?.status === 'pending_acceptance') {
      return <Navigate to="/invite/accept" replace />;
    }
    if (session?.status === 'denied' || session?.status === 'deactivated') {
      return <Navigate to="/invite/denied" replace />;
    }
    if (session?.status === 'active') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)] px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-heading text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Keycloak Demo
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground">
          API Key Management Portal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in with your organization account. Access is invitation-only — the first Super Admin
          is the seeded email, and everyone else must be invited.
        </p>
        <Button size="lg" className="mt-8 h-10 w-full max-w-xs px-6" onClick={() => login()}>
          Continue to Sign In
        </Button>
        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          This is a demo application showcasing Keycloak authentication (OIDC + PKCE) and role-based access control.
        </p>
      </div>
    </div>
  );
}
