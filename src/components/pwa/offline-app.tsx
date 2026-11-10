'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ConnectionStatus } from '@/components/layout/connection-status';
import { OfflineExpenses } from '@/components/expenses/offline-expenses';
import { OfflineSyncStatus } from '@/components/powersync/offline-sync-status';
import { OfflineWorkspace } from '@/components/powersync/offline-workspace';
import { OfflinePowerSyncProvider } from '@/lib/powersync/offline-provider';
import { createClient } from '@/lib/supabase/client';
import {
  discoverOfflineTenants,
  getOfflineTenantStorageKey,
  persistOfflineTenantSelection,
} from '@/lib/powersync/offline-storage';

type OfflineIdentity =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'tenant-missing' }
  | { status: 'tenant-choice'; userId: string; tenantIds: string[] }
  | { status: 'ready'; tenantId: string }
  | { status: 'error'; message: string };

function getRequestedPath() {
  const requested = new URLSearchParams(window.location.search).get('requested');
  if (!requested) return null;

  const url = new URL(requested, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  return url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
}

function subscribeToLocation(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}

export function OfflineApp() {
  const [identity, setIdentity] = useState<OfflineIdentity>({ status: 'loading' });
  const requestedPath = useSyncExternalStore(
    subscribeToLocation,
    getRequestedPath,
    () => null,
  );

  useEffect(() => {
    let active = true;

    async function loadLocalIdentity() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(`Could not read the local sign-in session: ${error.message}`);
        if (!data.session?.user.id) {
          if (active) setIdentity({ status: 'signed-out' });
          return;
        }

        const storageKey = getOfflineTenantStorageKey(data.session.user.id);
        const savedTenantId = window.localStorage.getItem(
          storageKey,
        );

        let tenantId = savedTenantId;
        if (!tenantId) {
          const discoveredTenants = await discoverOfflineTenants(data.session.user.id);
          if (discoveredTenants?.length === 1) {
            tenantId = discoveredTenants[0];
            try {
              persistOfflineTenantSelection(data.session.user.id, tenantId);
            } catch (cause: unknown) {
              console.error('Could not restore the offline tenant pointer:', cause);
            }
          } else if (discoveredTenants && discoveredTenants.length > 1) {
            if (active) {
              setIdentity({
                status: 'tenant-choice',
                userId: data.session.user.id,
                tenantIds: discoveredTenants,
              });
            }
            return;
          }
        }

        if (active) {
          setIdentity(tenantId
            ? { status: 'ready', tenantId }
            : { status: 'tenant-missing' });
        }
      } catch (cause: unknown) {
        if (active) {
          setIdentity({
            status: 'error',
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    }

    void loadLocalIdentity();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Local device workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Offline access</h1>
        </div>
        <ConnectionStatus />
      </header>

      {requestedPath && !['/expenses', '/offline-workspace'].includes(requestedPath) ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
          The requested page ({requestedPath}) needs an internet connection. Cached items and parties are available below.
        </p>
      ) : null}

      {identity.status === 'loading' ? (
        <p role="status">Opening your local workspace…</p>
      ) : null}
      {identity.status === 'signed-out' ? (
        <p role="alert">
          No signed-in account is available on this device. Connect to the internet and sign in before using offline access.
        </p>
      ) : null}
      {identity.status === 'tenant-missing' ? (
        <p role="alert">
          No local PowerSync database was found for this signed-in account on this device. Connect to the internet, open the workspace, and wait for local data to sync before using it offline.
        </p>
      ) : null}
      {identity.status === 'tenant-choice' ? (
        <section className="space-y-3" aria-labelledby="offline-tenant-heading">
          <h2 id="offline-tenant-heading" className="font-medium">Choose a local workspace</h2>
          <p className="text-sm text-muted-foreground">
            More than one tenant database belongs to this signed-in account on this device.
          </p>
          <ul className="space-y-2">
            {identity.tenantIds.map((tenantId) => (
              <li key={tenantId}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-md border px-4 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    try {
                      persistOfflineTenantSelection(
                        identity.userId,
                        tenantId,
                      );
                    } catch (cause: unknown) {
                      console.error('Could not save the selected offline tenant:', cause);
                    }
                    setIdentity({ status: 'ready', tenantId });
                  }}
                >
                  {tenantId}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {identity.status === 'error' ? (
        <p role="alert">Could not open offline access: {identity.message}</p>
      ) : null}

      {identity.status === 'ready' ? (
        <OfflinePowerSyncProvider
          tenantId={identity.tenantId}
          fallback={<p role="status">Opening your local database…</p>}
        >
          <OfflineSyncStatus />
          {requestedPath === '/expenses' ? (
            <OfflineExpenses tenantId={identity.tenantId} />
          ) : null}
          <OfflineWorkspace tenantId={identity.tenantId} />
        </OfflinePowerSyncProvider>
      ) : null}

      {requestedPath ? (
        <a
          className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
          href={requestedPath}
        >
          Retry requested page
        </a>
      ) : null}
    </main>
  );
}
