import { InvoiceForm } from '@/components/sales/invoice-form';
import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';

export default async function NewSalePage() {
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local item catalog…</p>}
    >
      <InvoiceForm itemLookupTenantId={tenantId} />
    </PowerSyncProvider>
  );
}
