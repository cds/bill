import { AdminHeader } from '@/components/layout/admin-header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <AdminHeader />
      <main className="flex-1 pb-20 sm:pb-6">{children}</main>
    </div>
  );
}
