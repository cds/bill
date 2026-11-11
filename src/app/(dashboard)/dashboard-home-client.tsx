'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { OfflineSyncStatus } from '@/components/powersync/offline-sync-status';
import { OfflineWorkspace } from '@/components/powersync/offline-workspace';

export function DashboardHomeClient({ initialTenantId }: { initialTenantId?: string | null }) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
      {(resolvedTenantId) => (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                Local-first workspace · sync controlled by the switch below
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <OfflineSyncStatus />
            </div>
          </div>
          <OfflineWorkspace tenantId={resolvedTenantId} />
        </>
      )}
    </DashboardTenantShell>
  );
}
