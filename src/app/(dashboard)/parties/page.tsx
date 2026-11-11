import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { PartiesDashboard } from './parties-dashboard';

export const metadata = {
  title: 'Parties',
};

export default async function PartiesPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <DashboardTenantShell initialTenantId={tenantId}>
        {(resolvedTenantId) => <PartiesDashboard tenantId={resolvedTenantId} />}
      </DashboardTenantShell>
    </div>
  );
}
