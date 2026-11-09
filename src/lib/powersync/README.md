# PowerSync browser client

PowerSync is mounted on `/offline-workspace`, the new-sale flow, and the expenses page for tenant members. Existing server-rendered pages and unrelated write APIs continue to use Supabase as before.

## Configuration

Set `NEXT_PUBLIC_POWERSYNC_URL` to the PowerSync service endpoint in the local development environment. The existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used by the browser Supabase client. Do not put database credentials, PowerSync administrative credentials, or Supabase service-role/JWT signing secrets in `NEXT_PUBLIC_*` variables.

The client subscribes to `current_tenant_items` and `current_tenant_parties` with the provided `tenant_id`. Deploy both matching, membership-guarded streams in the PowerSync development instance. Each stream must filter its table by the requested tenant, require the authenticated user to be a member of that tenant, and exclude rows with `deleted_at IS NOT NULL`. Do not rely on Supabase RLS to apply these PowerSync stream filters.

The connector reads the current session from the existing Supabase browser Auth client. It refreshes tokens that are expired, have unknown expiry, or expire within 60 seconds; signed-out users return no credentials, while failed refreshes raise an explicit error. It returns only the Supabase access token and PowerSync endpoint needed by the SDK.

## Browser persistence check

The `/offline-workspace` route provides the read-only local view. Load it online first and wait for both streams' initial sync before disconnecting. It displays locally stored item stock/prices and party names/types/balances, with loading, empty, and query-error states.

In the new-sale flow, tenant users' item and customer selection reads the local PowerSync tables and does not require `/api/items` or `/api/parties`. The existing edit-sale flow and super-admin new-sale flow retain online lookup. Cached item stock is an estimate: the database rejects an invoice atomically if its locked current stock cannot cover the sale. New invoice creation is available offline; editing and voiding invoices remain online-only.

## Offline expense creation

The tenant expenses page writes new expenses to the local insert-only PowerSync `expenses` table with a UUID generated in the browser, and writes a corresponding `pending` entry to local-only `expense_sync_status`. `SupabasePowerSyncConnector` posts CRUD entries to `/api/offline/expenses`; the server checks the authenticated user and current tenant membership, requires the submitted tenant to match the server-resolved tenant, and rejects ID conflicts unless the existing row exactly matches the same expense. Successfully uploaded records display `Synced`; permanent 4xx responses display `Rejected` with the server reason. Network, redirect/authentication, 408/429, and 5xx failures stay pending for SDK retry. The upload queue is completed only after each record is either accepted or permanently rejected.

Only expense creation is available offline. Pending/rejected local expense rows cannot be edited or deleted; retry is performed by the PowerSync uploader using the same stable UUID. Existing online edit and tenant-admin discard actions are unchanged for server-synced records. Expense submission still requires network access to reach the server before it is considered synced.

Verify with `npx vitest run src/__tests__/powersync-expenses.test.ts src/__tests__/api/offline-expenses.test.ts`. Test a new expense while offline, reconnect and check `Pending sync` changes to `Synced`, and revoke tenant membership before reconnecting to verify `Rejected` is visible and the record is not silently uploaded.

## Offline invoice creation

The tenant new-sale flow writes new invoices to the local insert-only `offline_invoices` table and a local-only `invoice_sync_status` row. It reuses the local invoice UUID as the server idempotency key at `/api/offline/invoices`, which forwards to the same atomic `create_invoice` RPC as online invoice creation. Retries with that UUID do not repeat invoice, stock, adjustment, or party-balance effects. Pending invoices show a local reference and estimated total, never an official invoice number. The official number and server invoice link appear only after acceptance.

Only new invoices can be created through this local queue. Existing invoice edits and voids continue through their online-only routes. Permanent server errors become visible rejected statuses with the server reason; users can retry the same operation after resolving a transient business condition (for example, replenishing stock) or start a corrected new sale. Network/redirect, 408/429, and 5xx failures remain queued for PowerSync retry. Server stock is authoritative and rejects overselling atomically, including concurrent sales from multiple devices.

Cached items and customers must have synced before disconnecting. Keep the new-sale page open while offline; the generic PWA cold-launch shell does not restore authenticated routes. Verify on the actual pilot devices: select cached items and customers offline, create an invoice, confirm only `Pending sync` and a local reference appear, reconnect, then confirm the server invoice number appears. Retry a request after a simulated lost response and verify only one invoice/stock adjustment/balance effect exists. Try an invoice whose quantity exceeds server stock and confirm it is rejected, the rejected reason and retry/recovery actions are shown, and no server invoice number or partial stock/balance effects are created.

Run focused tests with `npx vitest run src/__tests__/powersync-invoices.test.ts src/__tests__/api/offline-invoices.test.ts src/__tests__/api/invoices.test.ts`. Database stock-guard assertions are in `supabase/tests/010_reject_oversold_invoice_stock.test.sql` and require migration 010 to be applied in a development database before running.

For a development-only smoke check, render a child using the PowerSync React hooks:

```tsx
'use client';

import { useQuery, useStatus } from '@powersync/react';

export function PowerSyncItemsCheck({ tenantId }: { tenantId: string }) {
  const { connected, hasSynced } = useStatus();
  const { data, isLoading, error } = useQuery(
    'SELECT id, name, tenant_id FROM items WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name',
    [tenantId],
    { streams: [{ name: 'current_tenant_items', parameters: { tenant_id: tenantId }, waitForStream: true }] },
  );

  if (error) return <p role="alert">{error.message}</p>;
  if (isLoading) return <p>Loading local items…</p>;

  return (
    <pre>
      {JSON.stringify({ connected, hasSynced, items: data }, null, 2)}
    </pre>
  );
}
```

With the test Supabase user signed in:

1. Load the harness online and wait for `hasSynced` to become `true`; verify only the test tenant's active items appear.
2. Reload while online. Confirm the local query returns the already-persisted items, then disconnect the network and confirm the same query still works.
3. Reconnect and verify sync resumes. Repeat on each target browser/device (including Safari/iOS if supported).
4. Verify a different tenant ID returns no items for this user, then test a user without membership. Do not use real business data unless cross-tenant isolation passes.

The local database view remains usable while the already-open workspace is disconnected. The service worker's cold-launch fallback remains a static generic page; opening authenticated routes from a cold offline launch is not supported because routing still requires the server. Expense and new-invoice creation are the only supported local writes; other PowerSync CRUD tables remain unsupported.

Run the credential connector tests with `npx vitest run src/__tests__/powersync-connector.test.ts`.

## Tenant isolation and recovery checks

The browser database is keyed by authenticated user and tenant, and the workspace queries and PowerSync stream parameters include the selected tenant ID. Changing tenants removes the previous database from the rendered provider while the new database initializes. Signing out locks the provider; signing in initializes it again. The old IndexedDB database is retained for that same user/tenant rather than erased, so do not treat sign-out as secure device-data erasure.

The offline upload tests cover retries after a lost response using the same stable operation ID, revoked-membership rejection, and retention of visible rejected status. Run the focused checks with:

```bash
npx vitest run \
  src/__tests__/offline-tenant-isolation.test.tsx \
  src/__tests__/offline-invoice-status.test.tsx \
  src/__tests__/powersync-provider.test.tsx \
  src/__tests__/powersync-expenses.test.ts \
  src/__tests__/powersync-invoices.test.ts \
  src/__tests__/api/offline-expenses.test.ts \
  src/__tests__/api/offline-invoices.test.ts \
  src/__tests__/api/invoices.test.ts
```

## PWA offline shell verification

The root layout registers a service worker that network-loads navigations and falls back to the standalone `/offline.html` shell only when the request fails. It precaches that shell and its static resources, then caches immutable `/_next/static/` assets as they are requested. API, auth, RSC, Supabase, and tenant data responses are not cached. The shell is an entry path only; the authenticated PowerSync workspace is not yet mounted into it.

Verify on the actual supported phones and tablets, using HTTPS (or localhost):

1. Open the app online, wait for service-worker registration/activation, and load at least one route so static assets can be cached.
2. Install/add the app to the home screen where supported; launch it online once.
3. Force-close the browser/PWA, enable airplane mode, and cold-launch from the home-screen icon. Confirm the offline shell appears.
4. Open `/offline-workspace` while online and wait until locally synced items and parties appear. Disconnect the network with the screen still open and confirm both lists remain visible and interactive. A cold offline launch still shows the static shell rather than this route.
5. While still offline, reload the shell and try navigating to `/`, `/items`, and an API URL. Confirm navigations show only the generic shell and no private data; API requests must fail rather than receive cached data.
6. Re-enable networking and follow “Retry connection”. Confirm normal authenticated routing works, then inspect browser storage/service-worker caches to verify they contain only the shell assets and `/_next/static/` files—no API, RSC, or Supabase responses.
7. Repeat after updating the app and after clearing site data; check Safari/iOS, Chrome/Android, and desktop browsers used by the pilot. Verify cold launch behavior per browser because service-worker installation, eviction, and storage policies differ.
