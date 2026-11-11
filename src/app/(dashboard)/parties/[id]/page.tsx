import { PowerSyncProvider } from '@/lib/powersync/provider';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { PartyDetailDashboard } from './party-detail-dashboard';

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening party details…</p>}
    >
      <div className="container mx-auto py-8">
        <PartyDetailDashboard tenantId={tenantId} partyId={id} />
      </div>
    </PowerSyncProvider>
  );
}
