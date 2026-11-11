'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { PartyDetailDashboard } from './party-detail-dashboard';

export function PartyDetailPageClient({
  initialTenantId,
  partyId,
}: {
  initialTenantId?: string | null;
  partyId: string;
}) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <PartyDetailDashboard tenantId={resolvedTenantId} partyId={partyId} />}
    </DashboardTenantShell>
  );
}
