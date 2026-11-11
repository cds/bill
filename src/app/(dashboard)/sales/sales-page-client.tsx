'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { SalesDashboard } from './sales-dashboard';

export function SalesPageClient({ initialTenantId }: { initialTenantId?: string | null }) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <SalesDashboard tenantId={resolvedTenantId} />}
    </DashboardTenantShell>
  );
}
