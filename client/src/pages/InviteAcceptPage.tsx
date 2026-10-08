import { useState } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { acceptInvitation, declineInvitation } from '@/lib/api';

function roleLabel(role?: string) {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'ADMIN') return 'Admin';
  return 'User';
}

export function InviteAcceptPage() {
  const { initialized, authenticated, session, sessionLoading, refreshSession, logout } = useAuth();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!initialized || sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)]">
        <div className="text-sm text-muted-foreground">Checking your invitation…</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/welcome" replace />;
  }

  if (session?.status === 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  if (session?.status === 'denied' || session?.status === 'deactivated') {
    return <Navigate to="/invite/denied" replace />;
  }

  const invitation = session?.invitation;

  async function onAccept() {
    setBusy('accept');
    setError(null);
    try {
      await acceptInvitation();
      await refreshSession();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(message || 'Unable to accept this invitation.');
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    setBusy('decline');
    setError(null);
    try {
      await declineInvitation();
      logout();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(message || 'Unable to decline this invitation.');
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8eef7,#f7f5f1_55%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm">
        <p className="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">Invitation</p>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-slate-900">
          Join the Admin Portal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {invitation?.invitedByName || 'A Super Admin'} invited you to join as{' '}
          <span className="font-medium text-slate-900">{roleLabel(invitation?.role)}</span>.
        </p>
        {invitation?.expiresAt && (
          <p className="mt-2 text-xs text-slate-500">
            Expires {new Date(invitation.expiresAt).toLocaleString()}
          </p>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" disabled={busy !== null} onClick={() => void onAccept()}>
            {busy === 'accept' ? 'Accepting…' : 'Accept invitation'}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void onDecline()}
          >
            {busy === 'decline' ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      </div>
    </div>
  );
}
