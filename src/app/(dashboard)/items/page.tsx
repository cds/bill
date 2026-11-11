import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { ItemsDashboard } from './items-dashboard';

export default async function ItemsPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <DashboardTenantShell initialTenantId={tenantId}>
        {(resolvedTenantId) => <ItemsDashboard tenantId={resolvedTenantId} />}
      </DashboardTenantShell>
    </div>
  );
}
