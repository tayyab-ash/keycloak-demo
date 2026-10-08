import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApiKeyStats, type ApiKeyStats } from '@/lib/api';

export function DashboardPage() {
  const { username, email, userId, roles, tokenExpiresAt } = useAuth();
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeyStats()
      .then(setStats)
      .catch((err) => {
        setError(err?.response?.data?.message ?? 'Failed to load stats');
      });
  }, []);

  const cards = [
    {
      title: 'Total API Keys',
      value: stats?.total ?? '—',
      icon: KeyRound,
    },
    {
      title: 'Active Keys',
      value: stats?.active ?? '—',
      icon: ShieldCheck,
    },
    {
      title: 'Revoked Keys',
      value: stats?.revoked ?? '—',
      icon: ShieldOff,
    },
  ];

  const profileRows = [
    { label: 'Username', value: username },
    { label: 'Email', value: email || '—' },
    { label: 'User ID', value: userId || '—' },
    { label: 'Assigned Roles', value: roles.join(', ') || 'none' },
    {
      label: 'Token expiration',
      value: tokenExpiresAt ? tokenExpiresAt.toLocaleString() : '—',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">Welcome, {username}</h1>
        <p className="text-sm text-slate-600">
          Role(s): <span className="font-medium text-slate-900">{roles.length > 0 ? roles.join(', ') : 'none'}</span>
        </p>
      </section>

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Signed-in identity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {profileRows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{row.label}</dt>
                <dd className="mt-1 break-all text-sm text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title} className="bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              <Icon className="size-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
