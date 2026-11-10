import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { OfflineWorkspace } from '@/components/powersync/offline-workspace';
import { PowerSyncProvider } from '@/lib/powersync/provider';

export default async function OfflineWorkspacePage() {
  const tenantId = await getActiveTenantId();

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local workspace for this tenant…</p>}
    >
      <OfflineWorkspace tenantId={tenantId} />
    </PowerSyncProvider>
  );
}
