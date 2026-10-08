import { LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';

export function TopNav() {
  const { username, logout, roles } = useAuth();
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/60 px-6 backdrop-blur">
      <div>
        <p className="text-sm font-medium text-slate-900">API Key Portal</p>
        <p className="text-xs text-slate-500">Authenticated via Keycloak OIDC</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{username}</p>
          <p className="text-xs text-slate-500">{roles.join(', ') || 'no roles'}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials}
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut data-icon="inline-start" />
          Logout
        </Button>
      </div>
    </header>
  );
}
