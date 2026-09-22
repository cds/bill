import { headers } from 'next/headers';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const role = headersList.get('x-tenant-role') || 'worker';
  const systemRole = headersList.get('x-system-role') || 'user';
  
  return (
    <>
      <AppHeader userRole={role} systemRole={systemRole} />
      <main className="flex-1 pb-20 sm:pb-6">{children}</main>
      <BottomNav />
    </>
  );
}

