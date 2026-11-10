'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ConnectionStatus } from '@/components/layout/connection-status';
import { OfflineWorkspace } from '@/components/powersync/offline-workspace';
import { OfflinePowerSyncProvider } from '@/lib/powersync/offline-provider';
import { createClient } from '@/lib/supabase/client';
import { getOfflineTenantStorageKey } from '@/lib/powersync/offline-storage';

type OfflineIdentity =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'tenant-missing' }
  | { status: 'ready'; tenantId: string }
  | { status: 'error'; message: string };

function getRequestedPath() {
  const requested = new URLSearchParams(window.location.search).get('requested');
  if (!requested) return null;

  const url = new URL(requested, window.location.origin);
  return url.origin === window.location.origin ? url.pathname : null;
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

        const tenantId = window.localStorage.getItem(
          getOfflineTenantStorageKey(data.session.user.id),
        );
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

      {requestedPath && requestedPath !== '/offline-workspace' ? (
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
          This device has no saved tenant selection. Connect to the internet and open the workspace once to prepare offline access.
        </p>
      ) : null}
      {identity.status === 'error' ? (
        <p role="alert">Could not open offline access: {identity.message}</p>
      ) : null}

      {identity.status === 'ready' ? (
        <OfflinePowerSyncProvider
          tenantId={identity.tenantId}
          fallback={<p role="status">Opening your local database…</p>}
        >
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
