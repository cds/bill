'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { SalesDetailDashboard } from './sales-detail-dashboard';

export function SaleDetailPageClient({
  initialTenantId,
  invoiceId,
}: {
  initialTenantId?: string | null;
  invoiceId: string;
}) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <SalesDetailDashboard tenantId={resolvedTenantId} invoiceId={invoiceId} />}
    </DashboardTenantShell>
  );
}
