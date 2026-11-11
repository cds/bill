import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { SalesDetailDashboard } from './sales-detail-dashboard';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening sale details…</p>}
    >
      <div className="container mx-auto py-8">
        <SalesDetailDashboard tenantId={tenantId} invoiceId={id} />
      </div>
    </PowerSyncProvider>
  );
}
