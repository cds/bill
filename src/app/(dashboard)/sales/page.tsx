import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { SalesDashboard } from './sales-dashboard';

export default async function SalesPage() {
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local sales…</p>}
    >
      <div className="container mx-auto py-8">
        <SalesDashboard tenantId={tenantId} />
      </div>
    </PowerSyncProvider>
  );
}
