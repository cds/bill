'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { ItemDetailDashboard } from './item-detail-dashboard';

export function ItemDetailPageClient({
  initialTenantId,
  itemId,
}: {
  initialTenantId?: string | null;
  itemId: string;
}) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <ItemDetailDashboard tenantId={resolvedTenantId} itemId={itemId} />}
    </DashboardTenantShell>
  );
}
