import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { OfflineTenantPersistence } from '@/components/pwa/offline-tenant-persistence';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const role = headersList.get('x-tenant-role') || 'worker';
  const systemRole = headersList.get('x-system-role') || 'user';
  const selectedTenantId = headersList.get('x-tenant-id') ?? undefined;
  let tenants: Array<{ id: string; name: string }> = [];

  if (systemRole === 'super_admin') {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');
      tenants = data ?? [];
    } catch {
      tenants = [];
    }
  }

  return (
    <>
      <AppHeader
        userRole={role}
        systemRole={systemRole}
        tenants={tenants}
        selectedTenantId={selectedTenantId}
      />
      <OfflineTenantPersistence
        tenantId={selectedTenantId}
        enabled={Boolean(selectedTenantId)}
      />
      <main className="flex-1 pb-20 sm:pb-6">{children}</main>
      <BottomNav systemRole={systemRole} />
    </>
  );
}
