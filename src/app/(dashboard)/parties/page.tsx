import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { PartiesDashboard } from './parties-dashboard';

export const metadata = {
  title: 'Parties',
};

export default async function PartiesPage() {
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local parties…</p>}
    >
      <div className="container mx-auto py-8">
        <PartiesDashboard tenantId={tenantId} />
      </div>
    </PowerSyncProvider>
  );
}
