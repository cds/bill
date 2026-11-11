import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { ItemsDashboard } from './items-dashboard';

export default async function ItemsPage() {
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local items…</p>}
    >
      <div className="container mx-auto py-8">
        <ItemsDashboard tenantId={tenantId} />
      </div>
    </PowerSyncProvider>
  );
}
