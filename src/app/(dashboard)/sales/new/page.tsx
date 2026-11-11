import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { InvoiceForm } from '@/components/sales/invoice-form';

export default async function NewSalePage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <DashboardTenantShell initialTenantId={tenantId}>
      {(resolvedTenantId) => <InvoiceForm itemLookupTenantId={resolvedTenantId} />}
    </DashboardTenantShell>
  );
}
