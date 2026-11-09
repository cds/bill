import { Suspense } from 'react';
import { AdminHeader } from '@/components/layout/admin-header';
import { PageLoading } from '@/components/shared/page-loading';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <AdminHeader />
      <main className="flex-1 pb-20 sm:pb-6">
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </main>
    </div>
  );
}
