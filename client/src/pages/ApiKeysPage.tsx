import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Ban } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { CreateApiKeyModal } from '@/components/api-keys/CreateApiKeyModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToastManager } from '@/components/ui/toast';
import { createApiKey, deleteApiKey, fetchApiKeys, revokeApiKey, type ApiKey } from '@/lib/api';

function maskKey(key: string) {
  if (key.length <= 12) return key;
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

function getErrorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ?? fallback;
}

function getErrorStatus(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status;
}

export function ApiKeysPage() {
  const { canManageKeys } = useAuth();
  const toastManager = useToastManager();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApiKeys();
      setKeys(data);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load API keys');
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(name: string) {
    setCreating(true);
    try {
      await createApiKey(name);
      toastManager.add({
        title: 'API key created',
        description: `"${name}" is now active.`,
        type: 'success',
      });
      setModalOpen(false);
      await loadKeys();
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      const message = getErrorMessage(err, 'Unable to create API key');
      toastManager.add({
        title: status === 403 ? '403 Forbidden' : 'Create failed',
        description: Array.isArray(message) ? message.join(', ') : message,
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeApiKey(id);
      toastManager.add({
        title: 'Key revoked',
        type: 'success',
      });
      await loadKeys();
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      const message = getErrorMessage(err, 'Unable to revoke API key');
      toastManager.add({
        title: status === 403 ? '403 Forbidden' : 'Revoke failed',
        description: Array.isArray(message) ? message.join(', ') : message,
        type: 'error',
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApiKey(id);
      toastManager.add({
        title: 'Key deleted',
        type: 'success',
      });
      await loadKeys();
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      const message = getErrorMessage(err, 'Unable to delete API key');
      toastManager.add({
        title: status === 403 ? '403 Forbidden' : 'Delete failed',
        description: Array.isArray(message) ? message.join(', ') : message,
        type: 'error',
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">API Keys</h1>
          <p className="mt-1 text-sm text-slate-600">Manage integration keys. Mutations require the admin role.</p>
        </div>
        {canManageKeys && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus data-icon="inline-start" />
            Create API Key
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>All keys</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-slate-500">Loading keys…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-slate-500">No API keys yet.</p>
          ) : (
            <table className="w-full min-w-180 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Key</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  {canManageKeys && <th className="px-2 py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {keys.map((apiKey) => (
                  <tr key={apiKey.id} className="border-b border-slate-100">
                    <td className="px-2 py-3 font-medium text-slate-900">{apiKey.name}</td>
                    <td className="px-2 py-3 font-mono text-xs text-slate-600">{maskKey(apiKey.key)}</td>
                    <td className="px-2 py-3">
                      <span
                        className={
                          apiKey.status === 'ACTIVE'
                            ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                            : 'rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
                        }
                      >
                        {apiKey.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-700">{apiKey.owner}</td>
                    <td className="px-2 py-3 text-slate-600">{new Date(apiKey.createdAt).toLocaleString()}</td>
                    {canManageKeys && (
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          {apiKey.status === 'ACTIVE' && (
                            <Button variant="outline" size="xs" onClick={() => handleRevoke(apiKey.id)}>
                              <Ban data-icon="inline-start" />
                              Revoke
                            </Button>
                          )}
                          <Button variant="destructive" size="xs" onClick={() => handleDelete(apiKey.id)}>
                            <Trash2 data-icon="inline-start" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <CreateApiKeyModal
        open={modalOpen}
        loading={creating}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
