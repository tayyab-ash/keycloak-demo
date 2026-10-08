import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToastManager } from '@/components/ui/toast';
import {
  createInvitation,
  fetchInvitations,
  fetchPortalUsers,
  resendInvitation,
  revokeInvitation,
  updatePortalUser,
  type Invitation,
  type PortalRole,
  type PortalUser,
} from '@/lib/api';

function getErrorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ?? fallback;
}

function roleLabel(role: string) {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'ADMIN') return 'Admin';
  return 'User';
}

export function UsersPage() {
  const { userId } = useAuth();
  const toastManager = useToastManager();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<PortalRole, 'SUPER_ADMIN'>>('ADMIN');
  const [inviting, setInviting] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, inviteList] = await Promise.all([fetchPortalUsers(), fetchInvitations()]);
      setUsers(userList);
      setInvitations(inviteList);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load users and invitations');
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    try {
      await createInvitation(inviteEmail, inviteRole);
      toastManager.add({
        title: 'Invitation sent',
        description: `${inviteEmail} was invited as ${roleLabel(inviteRole)}.`,
        type: 'success',
      });
      setInviteEmail('');
      await loadData();
    } catch (err: unknown) {
      toastManager.add({
        title: 'Invite failed',
        description: String(getErrorMessage(err, 'Unable to send invitation')),
        type: 'error',
      });
    } finally {
      setInviting(false);
    }
  }

  async function handleResend(id: string) {
    setBusyInviteId(id);
    try {
      await resendInvitation(id);
      toastManager.add({ title: 'Invitation resent', type: 'success' });
      await loadData();
    } catch (err: unknown) {
      toastManager.add({
        title: 'Resend failed',
        description: String(getErrorMessage(err, 'Unable to resend')),
        type: 'error',
      });
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRevoke(id: string) {
    setBusyInviteId(id);
    try {
      await revokeInvitation(id);
      toastManager.add({ title: 'Invitation revoked', type: 'success' });
      await loadData();
    } catch (err: unknown) {
      toastManager.add({
        title: 'Revoke failed',
        description: String(getErrorMessage(err, 'Unable to revoke')),
        type: 'error',
      });
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRoleChange(user: PortalUser, role: PortalRole) {
    if (user.id === userId) {
      toastManager.add({
        title: 'Action blocked',
        description: 'You cannot change your own role.',
        type: 'error',
      });
      return;
    }
    setBusyUserId(user.id);
    try {
      await updatePortalUser(user.id, { role });
      toastManager.add({ title: 'Role updated', type: 'success' });
      await loadData();
    } catch (err: unknown) {
      toastManager.add({
        title: 'Update failed',
        description: String(getErrorMessage(err, 'Unable to update role')),
        type: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleStatusToggle(user: PortalUser) {
    if (user.id === userId) {
      toastManager.add({
        title: 'Action blocked',
        description: 'You cannot change your own status.',
        type: 'error',
      });
      return;
    }
    const status = user.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    setBusyUserId(user.id);
    try {
      await updatePortalUser(user.id, { status });
      toastManager.add({
        title: status === 'ACTIVE' ? 'User activated' : 'User deactivated',
        type: 'success',
      });
      await loadData();
    } catch (err: unknown) {
      toastManager.add({
        title: 'Update failed',
        description: String(getErrorMessage(err, 'Unable to update status')),
        type: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Invite people who already exist in the identity provider, then manage portal roles here.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Send invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void handleInvite(event)}>
            <label className="flex-1 text-sm">
              <span className="mb-1 block text-slate-500">Email</span>
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="jane@bank.com"
              />
            </label>
            <label className="text-sm sm:w-40">
              <span className="mb-1 block text-slate-500">Role</span>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as Exclude<PortalRole, 'SUPER_ADMIN'>)
                }
              >
                <option value="ADMIN">Admin</option>
                <option value="USER">User</option>
              </select>
            </label>
            <Button type="submit" disabled={inviting}>
              {inviting ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500">Loading invitations…</p>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-slate-500">No invitations yet.</p>
          ) : (
            <table className="w-full min-w-180 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Invited by</th>
                  <th className="px-2 py-2 font-medium">Expires</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const busy = busyInviteId === invitation.id;
                  return (
                    <tr key={invitation.id} className="border-b border-slate-100">
                      <td className="px-2 py-3 text-slate-900">{invitation.email}</td>
                      <td className="px-2 py-3">{roleLabel(invitation.role)}</td>
                      <td className="px-2 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {invitation.status.toLowerCase()}
                          {invitation.type === 'BOOTSTRAP' ? ' · bootstrap' : ''}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {invitation.invitedBy?.name || invitation.invitedBy?.email || 'system'}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          {invitation.type !== 'BOOTSTRAP' &&
                            (invitation.status === 'PENDING' || invitation.status === 'EXPIRED') && (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleResend(invitation.id)}
                              >
                                Resend
                              </Button>
                            )}
                          {invitation.status === 'PENDING' && invitation.type !== 'BOOTSTRAP' && (
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleRevoke(invitation.id)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Portal users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">No portal users yet. Sign in as the bootstrap Super Admin first.</p>
          ) : (
            <table className="w-full min-w-180 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const busy = busyUserId === user.id;
                  return (
                    <tr key={user.id} className="border-b border-slate-100">
                      <td className="px-2 py-3 font-medium text-slate-900">{user.name}</td>
                      <td className="px-2 py-3 text-slate-700">{user.email}</td>
                      <td className="px-2 py-3">
                        {user.role === 'SUPER_ADMIN' ? (
                          <span className="text-sm text-slate-700">{roleLabel(user.role)}</span>
                        ) : (
                          <select
                            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                            value={user.role}
                            disabled={busy || user.id === userId}
                            onChange={(event) =>
                              void handleRoleChange(user, event.target.value as PortalRole)
                            }
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="USER">User</option>
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={
                            user.status === 'ACTIVE'
                              ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                              : 'rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
                          }
                        >
                          {user.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy || user.id === userId}
                          onClick={() => void handleStatusToggle(user)}
                        >
                          {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
