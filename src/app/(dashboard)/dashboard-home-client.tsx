'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { UnifiedDashboard } from '@/components/powersync/unified-dashboard';

export function DashboardHomeClient({ initialTenantId }: { initialTenantId?: string | null }) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <UnifiedDashboard tenantId={resolvedTenantId} />}
    </DashboardTenantShell>
  );
}
