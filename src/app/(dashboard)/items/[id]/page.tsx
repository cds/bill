import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { ItemDetailDashboard } from './item-detail-dashboard';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <DashboardTenantShell initialTenantId={tenantId}>
        {(resolvedTenantId) => <ItemDetailDashboard tenantId={resolvedTenantId} itemId={id} />}
      </DashboardTenantShell>
    </div>
  );
}
