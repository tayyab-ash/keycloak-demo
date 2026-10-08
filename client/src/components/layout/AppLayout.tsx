import { Outlet } from 'react-router';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dce7f5_0%,transparent_40%),radial-gradient(circle_at_100%_0%,#efe8dc_0%,transparent_35%),linear-gradient(180deg,#f6f4ef,#eef2f7)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 overflow-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
