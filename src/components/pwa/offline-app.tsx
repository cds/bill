'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ConnectionStatus } from '@/components/layout/connection-status';
import { OfflineExpenses } from '@/components/expenses/offline-expenses';
import { InvoiceForm } from '@/components/sales/invoice-form';
import { OfflineItems } from '@/components/items/offline-items';
import { OfflineItemDetail } from '@/components/items/offline-item-detail';
import { OfflineItemForm } from '@/components/items/offline-item-form';
import { OfflineParties } from '@/components/parties/offline-parties';
import { OfflinePartyDetail } from '@/components/parties/offline-party-detail';
import { OfflinePartyForm } from '@/components/parties/offline-party-form';
import { OfflineSales } from '@/components/sales/offline-sales';
import { OfflineInvoiceDetail } from '@/components/sales/offline-invoice-detail';
import { OfflineReports } from '@/components/reports/offline-reports';
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

const OFFLINE_ROUTES = [
  { path: '/offline-workspace', label: 'Workspace' },
  { path: '/items', label: 'Items' },
  { path: '/parties', label: 'Parties' },
  { path: '/sales', label: 'Sales' },
  { path: '/sales/new', label: 'New sale' },
  { path: '/expenses', label: 'Expenses' },
  { path: '/reports', label: 'Reports' },
] as const;

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

function parseRequestedRoute(path: string | null) {
  if (!path || path === '/' || path === '/offline-workspace') {
    return { type: 'workspace' as const };
  }
  if (path === '/expenses') return { type: 'expenses' as const };
  if (path === '/sales/new') return { type: 'sale-new' as const };
  if (path === '/sales') return { type: 'sales' as const };
  const saleMatch = path.match(/^\/sales\/([^/]+)$/);
  if (saleMatch && saleMatch[1] !== 'new') {
    return { type: 'sale-detail' as const, id: decodeURIComponent(saleMatch[1]) };
  }
  if (path === '/items/new') return { type: 'item-new' as const };
  if (path === '/items') return { type: 'items' as const };
  const itemMatch = path.match(/^\/items\/([^/]+)$/);
  if (itemMatch && itemMatch[1] !== 'new') {
    return { type: 'item-detail' as const, id: decodeURIComponent(itemMatch[1]) };
  }
  if (path === '/parties/new') return { type: 'party-new' as const };
  if (path === '/parties') return { type: 'parties' as const };
  const partyMatch = path.match(/^\/parties\/([^/]+)$/);
  if (partyMatch && partyMatch[1] !== 'new') {
    return { type: 'party-detail' as const, id: decodeURIComponent(partyMatch[1]) };
  }
  if (path === '/reports') return { type: 'reports' as const, sub: 'hub' as const };
  if (path === '/reports/sales') return { type: 'reports' as const, sub: 'sales' as const };
  if (path === '/reports/stock') return { type: 'reports' as const, sub: 'stock' as const };
  if (path === '/reports/parties') return { type: 'reports' as const, sub: 'parties' as const };
  if (path === '/reports/expenses') return { type: 'reports' as const, sub: 'expenses' as const };

  return { type: 'unsupported' as const, path };
}

export function OfflineApp() {
  const [identity, setIdentity] = useState<OfflineIdentity>({ status: 'loading' });
  const requestedPath = useSyncExternalStore(
    subscribeToLocation,
    getRequestedPath,
    () => null,
  );

  const route = parseRequestedRoute(requestedPath);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', `/offline-app?requested=${encodeURIComponent(path)}`);
    window.dispatchEvent(new Event('popstate'));
  };

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
        const savedTenantId = window.localStorage.getItem(storageKey);

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

  // Determine active route label for navigation bar
  const isNavActive = (path: string) => {
    if (path === '/offline-workspace') {
      return route.type === 'workspace';
    }
    if (path === '/items') {
      return route.type === 'items' || route.type === 'item-detail';
    }
    if (path === '/parties') {
      return route.type === 'parties' || route.type === 'party-detail';
    }
    if (path === '/sales') {
      return route.type === 'sales' || route.type === 'sale-detail';
    }
    if (path === '/sales/new') {
      return route.type === 'sale-new';
    }
    if (path === '/expenses') {
      return route.type === 'expenses';
    }
    if (path === '/reports') {
      return route.type === 'reports';
    }
    return false;
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Local device workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Offline access</h1>
        </div>
        <ConnectionStatus />
      </header>

      {identity.status === 'ready' ? (
        <nav className="flex flex-wrap gap-2 print:hidden" aria-label="Offline workspace pages">
          {OFFLINE_ROUTES.map(({ path, label }) => (
            <a
              key={path}
              href={`/offline-app?requested=${encodeURIComponent(path)}`}
              aria-current={isNavActive(path) ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm ${
                isNavActive(path) ? 'bg-muted font-medium' : 'hover:bg-muted'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
      ) : null}

      {route.type === 'unsupported' ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
          The requested page ({route.path}) is not available in the offline workspace. Use the offline pages above or retry when connected.
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
                      persistOfflineTenantSelection(identity.userId, tenantId);
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
          {route.type === 'expenses' ? <OfflineExpenses tenantId={identity.tenantId} /> : null}
          {route.type === 'items' ? (
            <OfflineItems
              tenantId={identity.tenantId}
              onSelectItem={(id) => navigateTo(`/items/${id}`)}
            />
          ) : null}
          {route.type === 'item-new' ? (
            <OfflineItemForm
              tenantId={identity.tenantId}
              onSaved={(id) => navigateTo(`/items/${id}`)}
              onCancel={() => navigateTo('/items')}
            />
          ) : null}
          {route.type === 'item-detail' ? (
            <OfflineItemDetail
              tenantId={identity.tenantId}
              itemId={route.id}
              onBack={() => navigateTo('/items')}
            />
          ) : null}
          {route.type === 'parties' ? (
            <OfflineParties
              tenantId={identity.tenantId}
              onSelectParty={(id) => navigateTo(`/parties/${id}`)}
            />
          ) : null}
          {route.type === 'party-new' ? (
            <OfflinePartyForm
              tenantId={identity.tenantId}
              onSaved={(id) => navigateTo(`/parties/${id}`)}
              onCancel={() => navigateTo('/parties')}
            />
          ) : null}
          {route.type === 'party-detail' ? (
            <OfflinePartyDetail
              tenantId={identity.tenantId}
              partyId={route.id}
              onBack={() => navigateTo('/parties')}
              onSelectInvoice={(id) => navigateTo(`/sales/${id}`)}
            />
          ) : null}
          {route.type === 'sales' ? (
            <OfflineSales
              tenantId={identity.tenantId}
              onSelectInvoice={(id) => navigateTo(`/sales/${id}`)}
            />
          ) : null}
          {route.type === 'sale-detail' ? (
            <OfflineInvoiceDetail
              tenantId={identity.tenantId}
              invoiceId={route.id}
              onBack={() => navigateTo('/sales')}
            />
          ) : null}
          {route.type === 'sale-new' ? (
            <InvoiceForm itemLookupTenantId={identity.tenantId} />
          ) : null}
          {route.type === 'reports' ? (
            <OfflineReports
              tenantId={identity.tenantId}
              reportType={route.sub}
              onNavigate={(path) => navigateTo(path)}
            />
          ) : null}
          {route.type === 'workspace' || route.type === 'unsupported' ? (
            <OfflineWorkspace
              tenantId={identity.tenantId}
              onNavigate={(path) => navigateTo(path)}
            />
          ) : null}
        </OfflinePowerSyncProvider>
      ) : null}

      {requestedPath ? (
        <a
          className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted print:hidden"
          href={requestedPath}
        >
          Retry requested page
        </a>
      ) : null}
    </main>
  );
}
