import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium tracking-wide text-slate-500 uppercase">Forbidden</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-slate-900">403 - Access Denied</h1>
        <p className="mt-3 text-sm text-slate-600">
          You do not have the Super Admin role required to manage users and invitations.
        </p>
        <Link to="/dashboard" className={cn(buttonVariants(), 'mt-6 inline-flex')}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
