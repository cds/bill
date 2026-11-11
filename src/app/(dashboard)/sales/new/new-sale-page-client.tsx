'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { InvoiceForm } from '@/components/sales/invoice-form';

export function NewSalePageClient({ initialTenantId }: { initialTenantId?: string | null }) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => <InvoiceForm itemLookupTenantId={resolvedTenantId} />}
    </DashboardTenantShell>
  );
}
