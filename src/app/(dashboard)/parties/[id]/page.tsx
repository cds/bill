import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { PartyDetailDashboard } from './party-detail-dashboard';

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <DashboardTenantShell initialTenantId={tenantId}>
        {(resolvedTenantId) => <PartyDetailDashboard tenantId={resolvedTenantId} partyId={id} />}
      </DashboardTenantShell>
    </div>
  );
}
