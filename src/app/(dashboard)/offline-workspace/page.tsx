import { headers } from 'next/headers';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { OfflineWorkspace } from '@/components/powersync/offline-workspace';
import { PowerSyncProvider } from '@/lib/powersync/provider';

export default async function OfflineWorkspacePage() {
  const requestHeaders = await headers();
  const systemRole = requestHeaders.get('x-system-role') || 'user';
  const tenantId = await getActiveTenantId();

  if (systemRole === 'super_admin') {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Offline workspace unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          Offline access is limited to tenant members in this pilot.
        </p>
      </section>
    );
  }

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local workspace…</p>}
    >
      <OfflineWorkspace tenantId={tenantId} />
    </PowerSyncProvider>
  );
}
