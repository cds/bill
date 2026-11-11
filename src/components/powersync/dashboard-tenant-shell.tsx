'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PowerSyncProvider } from '@/lib/powersync/provider';
import { createClient } from '@/lib/supabase/client';
import {
  discoverOfflineTenants,
  getOfflineTenantStorageKey,
  persistOfflineTenantSelection,
} from '@/lib/powersync/offline-storage';

type TenantState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'tenant-missing' }
  | { status: 'tenant-choice'; userId: string; tenantIds: string[] }
  | { status: 'ready'; tenantId: string }
  | { status: 'error'; message: string };

export function DashboardTenantShell({
  initialTenantId,
  children,
}: {
  initialTenantId?: string | null;
  children: (tenantId: string) => ReactNode;
}) {
  const [state, setState] = useState<TenantState>(
    initialTenantId ? { status: 'ready', tenantId: initialTenantId } : { status: 'loading' },
  );

  useEffect(() => {
    let active = true;

    if (initialTenantId) {
      // Persist server-resolved tenant for offline boot, but keep using it now.
      void (async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          const userId = data.session?.user.id;
          if (userId) persistOfflineTenantSelection(userId, initialTenantId);
        } catch {
          // best effort
        }
      })();
      return () => {
        active = false;
      };
    }

    async function resolve() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(`Could not read the local sign-in session: ${error.message}`);
        const userId = data.session?.user.id;
        if (!userId) {
          if (active) setState({ status: 'signed-out' });
          return;
        }

        const storageKey = getOfflineTenantStorageKey(userId);
        let tenantId = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        if (!tenantId) {
          const discovered = await discoverOfflineTenants(userId);
          if (discovered?.length === 1) {
            tenantId = discovered[0];
            try {
              persistOfflineTenantSelection(userId, tenantId);
            } catch {
              // ignore
            }
          } else if (discovered && discovered.length > 1) {
            if (active) setState({ status: 'tenant-choice', userId, tenantIds: discovered });
            return;
          }
        }

        if (active) {
          setState(tenantId ? { status: 'ready', tenantId } : { status: 'tenant-missing' });
        }
      } catch (cause: unknown) {
        if (active) {
          setState({ status: 'error', message: cause instanceof Error ? cause.message : String(cause) });
        }
      }
    }

    void resolve();
    return () => {
      active = false;
    };
  }, [initialTenantId]);

  if (state.status === 'loading') {
    return <p role="status" className="p-6">Opening your local workspace…</p>;
  }
  if (state.status === 'signed-out') {
    return (
      <p role="alert" className="p-6">
        No signed-in account is available on this device. Connect to the internet and sign in before using offline access.
      </p>
    );
  }
  if (state.status === 'tenant-missing') {
    return (
      <p role="alert" className="p-6">
        No local workspace was found for this account on this device. Connect to the internet, open the dashboard once, and wait for local data to sync before using it offline.
      </p>
    );
  }
  if (state.status === 'tenant-choice') {
    return (
      <section className="space-y-3 p-6" aria-labelledby="offline-tenant-heading">
        <h2 id="offline-tenant-heading" className="font-medium">Choose a local workspace</h2>
        <p className="text-sm text-muted-foreground">More than one tenant database belongs to this signed-in account on this device.</p>
        <ul className="space-y-2">
          {state.tenantIds.map((tenantId) => (
            <li key={tenantId}>
              <button
                type="button"
                className="min-h-11 w-full rounded-md border px-4 text-left text-sm hover:bg-muted"
                onClick={() => {
                  try {
                    persistOfflineTenantSelection(state.userId, tenantId);
                  } catch {
                    // ignore
                  }
                  setState({ status: 'ready', tenantId });
                }}
              >
                {tenantId}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (state.status === 'error') {
    return <p role="alert" className="p-6">Could not open local workspace: {state.message}</p>;
  }

  return (
    <PowerSyncProvider
      tenantId={state.tenantId}
      fallback={<p role="status" className="p-6">Opening local database…</p>}
    >
      {children(state.tenantId)}
    </PowerSyncProvider>
  );
}
