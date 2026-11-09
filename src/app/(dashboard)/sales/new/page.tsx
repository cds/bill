import { headers } from 'next/headers';
import { InvoiceForm } from '@/components/sales/invoice-form';
import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';

export default async function NewSalePage() {
  const requestHeaders = await headers();
  const systemRole = requestHeaders.get('x-system-role') || 'user';
  const tenantId = await getActiveTenantId();

  if (systemRole === 'super_admin') {
    return <InvoiceForm />;
  }

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local item catalog…</p>}
    >
      <InvoiceForm itemLookupTenantId={tenantId} />
    </PowerSyncProvider>
  );
}
