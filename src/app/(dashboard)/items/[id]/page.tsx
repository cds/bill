import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { ItemDetailDashboard } from './item-detail-dashboard';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening item details…</p>}
    >
      <div className="container mx-auto py-8">
        <ItemDetailDashboard tenantId={tenantId} itemId={id} />
      </div>
    </PowerSyncProvider>
  );
}
