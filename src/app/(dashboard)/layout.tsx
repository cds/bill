import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader />
      <main className="flex-1 pb-20 sm:pb-6">{children}</main>
      <BottomNav />
    </>
  );
}

