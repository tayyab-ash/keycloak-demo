import { Navigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';

export function InviteDeniedPage() {
  const { initialized, authenticated, session, loginWithDifferentAccount, logout } = useAuth();

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)]">
        <div className="text-sm text-muted-foreground">Connecting to identity provider…</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/welcome" replace />;
  }

  if (session?.status === 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  if (session?.status === 'pending_acceptance') {
    return <Navigate to="/invite/accept" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)] px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-heading text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Access denied
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground">
          You need an invitation
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {session?.message ||
            "Your account isn't authorized for the Admin Portal. Ask your Super Admin to invite you."}
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button size="lg" className="w-full max-w-xs" onClick={() => loginWithDifferentAccount()}>
            Sign in with a different account
          </Button>
          <Button size="lg" variant="outline" className="w-full max-w-xs" onClick={() => logout()}>
            Back to welcome
          </Button>
        </div>
      </div>
    </div>
  );
}
