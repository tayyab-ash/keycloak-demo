import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatAudience(audience: string | string[] | undefined) {
  if (!audience) return '—';
  return Array.isArray(audience) ? audience.join(', ') : audience;
}

export function SessionInfoPage() {
  const { username, email, userId, roles, claims, tokenExpiresAt } = useAuth();

  const rows = [
    { label: 'Username', value: username },
    { label: 'Email', value: email || '—' },
    { label: 'User ID', value: userId || '—' },
    { label: 'Portal role', value: roles.join(', ') || '—' },
    {
      label: 'Token Expiry',
      value: tokenExpiresAt ? tokenExpiresAt.toLocaleString() : '—',
    },
    { label: 'Issuer', value: claims?.iss ?? '—' },
    { label: 'Subject', value: claims?.sub ?? '—' },
    { label: 'Audience', value: formatAudience(claims?.aud) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">Session Info</h1>
        <p className="mt-1 text-sm text-slate-600">
          Identity comes from Keycloak. The portal role comes from the Admin Portal database.
        </p>
      </div>

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Access token claims</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:items-center">
                <dt className="text-sm font-medium text-slate-500">{row.label}</dt>
                <dd className="break-all text-sm text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
