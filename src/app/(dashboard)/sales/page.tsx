import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { SalesDashboard } from './sales-dashboard';

export default async function SalesPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <DashboardTenantShell initialTenantId={tenantId}>
        {(resolvedTenantId) => <SalesDashboard tenantId={resolvedTenantId} />}
      </DashboardTenantShell>
    </div>
  );
}
