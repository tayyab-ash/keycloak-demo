import { NavLink } from 'react-router';
import { KeyRound, LayoutDashboard, Users, UserRound } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/api-keys', label: 'API Keys', icon: KeyRound },
  { to: '/session', label: 'Session Info', icon: UserRound },
];

export function Sidebar() {
  const { isSuperAdmin } = useAuth();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 backdrop-blur">
      <div className="border-b border-slate-200/80 px-5 py-6">
        <p className="font-heading text-lg font-semibold tracking-tight text-slate-900">KeyVault</p>
        <p className="mt-1 text-xs text-slate-500">API Key Management Portal</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}

        {isSuperAdmin && (
          <NavLink
            to="/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Users className="size-4" />
            Users
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
