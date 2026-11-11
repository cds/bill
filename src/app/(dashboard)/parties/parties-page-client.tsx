'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { PartiesDashboard } from './parties-dashboard';

export function PartiesPageClient({ initialTenantId }: { initialTenantId?: string | null }) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <PartiesDashboard tenantId={resolvedTenantId} />}
    </DashboardTenantShell>
  );
}
