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
  const selectedTenantId = headersList.get('x-tenant-id');
  let tenants: Array<{ id: string; name: string }> = [];

  if (systemRole === 'super_admin') {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .order('name');

    if (error) {
      throw new Error(`Failed to load tenants for the switcher: ${error.message}`);
    }

    tenants = data;
  }
  
  return (
    <>
      <AppHeader
        userRole={role}
        systemRole={systemRole}
        tenants={tenants}
        selectedTenantId={selectedTenantId ?? undefined}
      />
      <OfflineTenantPersistence
        tenantId={selectedTenantId ?? undefined}
        enabled={Boolean(selectedTenantId)}
      />
      <main className="flex-1 pb-20 sm:pb-6">{children}</main>
      <BottomNav systemRole={systemRole} />
    </>
  );
}
