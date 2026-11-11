'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { ItemsDashboard } from './items-dashboard';

export function ItemsDashboardPage({ initialTenantId }: { initialTenantId?: string | null }) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <ItemsDashboard tenantId={resolvedTenantId} />}
    </DashboardTenantShell>
  );
}
