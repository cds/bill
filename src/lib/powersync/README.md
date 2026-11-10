# PowerSync browser client

PowerSync is mounted on `/offline-workspace`, the new-sale flow, and the expenses page for tenant members. Existing server-rendered pages and unrelated write APIs continue to use Supabase as before.

## Configuration

Set `NEXT_PUBLIC_POWERSYNC_URL` to the PowerSync service endpoint in the local development environment. The existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used by the browser Supabase client. Do not put database credentials, PowerSync administrative credentials, or Supabase service-role/JWT signing secrets in `NEXT_PUBLIC_*` variables.

The dashboard-ready config is in [`powersync/sync-streams.yaml`](../../../powersync/sync-streams.yaml). Deploy it in the production PowerSync Dashboard under **Sync Streams**. The app subscribes to `tenant_data` with the selected `tenant_id`; the stream itself independently checks that the signed-in user is a member of that tenant or has the trusted `users.system_role = 'super_admin'` role, and excludes soft-deleted records. This keeps super-admin access limited to the currently selected tenant rather than syncing all tenants. Do not rely on Supabase RLS to apply PowerSync stream filters.

The app's current offline coverage is limited to items, parties, expense creation, and new invoice creation. Never trust a client-selected tenant ID by itself. The current stream is read-only; offline writes use server-validated upload endpoints rather than PowerSync table CRUD uploads.

The connector reads the current session from the existing Supabase browser Auth client. It refreshes tokens that are expired, have unknown expiry, or expire within 60 seconds; signed-out users return no credentials, while failed refreshes raise an explicit error. It returns only the Supabase access token and PowerSync endpoint needed by the SDK.

## Browser persistence check

The `/offline-workspace` route provides the read-only local view. Load it online once to initialize PowerSync and populate its local database. Queries render rows already stored locally immediately while streams continue syncing in the background; a fresh stream sync is not required to see cached rows. It displays item stock/prices and party names/types/balances, with loading, empty, and query-error states.

In the new-sale flow, tenant users' item and customer selection reads the local PowerSync tables and does not require `/api/items` or `/api/parties`. The existing edit-sale flow and super-admin new-sale flow retain online lookup. Cached item stock is an estimate: the database rejects an invoice atomically if its locked current stock cannot cover the sale. New invoice creation is available offline; editing and voiding invoices remain online-only.

## Offline expense creation

The tenant expenses page writes new expenses to the local insert-only PowerSync `expenses` table with a UUID generated in the browser, and writes the full local display row with `pending` status to local-only `expense_sync_status` in the same transaction. The offline expense list reads that local-only row first, so a new expense is visible immediately and remains visible across offline refreshes without waiting for the server upload; it falls back to the synced `expenses` row for records created before this local display data was added. `SupabasePowerSyncConnector` posts CRUD entries to `/api/offline/expenses`; the server checks the authenticated user and tenant membership (or verified super-admin role and tenant) and rejects ID conflicts unless the existing row exactly matches the same expense. Successfully uploaded records display `Synced`; permanent 4xx responses display `Rejected` with the server reason. Network, redirect/authentication, 408/429, and 5xx failures stay pending for SDK retry. The upload queue is completed only after each record is either accepted or permanently rejected.

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
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
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

The `/offline-app` public entry is a generic client shell with no tenant or account data embedded in its cached HTML. On an offline navigation or refresh, the service worker redirects to this cached shell and records only the requested path. During installation, the worker caches the shell's static JavaScript/CSS dependencies and their referenced static workers, WASM, and font assets. Successful online navigations refresh this generic shell cache so offline refreshes do not keep using an older app bundle. The app reads the current Supabase session from local browser storage, then opens that signed-in user's selected PowerSync database. Tenant members are scoped to their membership tenant; super admins use the currently selected tenant from the tenant switcher. That selection is stored under a user-specific local-storage key; if the pointer is missing, the app recovers tenant IDs from matching local IndexedDB database names when the browser supports enumeration, and asks the user to choose if several exist. This is a local database selector, not authorization. The offline app shows PowerSync's actual connection, download/upload activity, first-sync state, last successful sync time, and errors; its **Sync now** button reconnects through the normal connector to retry synchronization when the browser is online. Private route HTML and API responses are never cached. Offline refresh of `/expenses` opens the local expense list and form: entries appear as pending locally and remain queued until the existing server endpoint accepts them. Rejected server responses show their reason. The cached items and parties workspace remains read-only, and other routes are online-only.

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

The root layout registers a service worker that network-loads navigations and redirects failed page loads to the cached `/offline-app` entry. It precaches that data-free document plus its referenced JavaScript, CSS, worker, WASM, and font assets. Other `/_next/static/` assets are cached when requested. API, auth, RSC, Supabase, and private page responses are never cached. The generic `/offline.html` shell is retained only as a last-resort fallback if the app entry could not be cached.

Verify on the actual supported phones and tablets, using HTTPS (or localhost):

1. Open the app online and visit `/offline-workspace` or `/expenses` after service-worker registration. The worker pre-caches the data-free `/offline-app` document and its static JavaScript/CSS dependencies; PowerSync initialization records the selected tenant under the signed-in user ID.
2. Install/add the app to the home screen where supported; launch it online once.
3. Force-close the browser/PWA, enable airplane mode, and cold-launch from the home-screen icon. Confirm the local offline app opens rather than the generic last-resort shell.
4. Open `/offline-workspace` while online and wait until locally synced items and parties appear. Disconnect the network and refresh; verify the offline app opens and displays the same local rows.
5. While still offline, refresh `/expenses` and create an expense. It should appear locally as `Pending sync`; reconnect and verify it becomes `Synced` or a visible `Rejected`. Refresh `/`, `/items`, and `/sales/new`; those routes should explain they are online-only while showing cached workspace data. API requests must fail rather than receive cached data.
6. Re-enable networking and follow “Retry requested page”. Confirm normal authenticated routing works, then inspect browser storage/service-worker caches to verify they contain only the static offline app/shell assets and `/_next/static/` files—no API, RSC, or Supabase responses.
7. Repeat after updating the app and after clearing site data; check Safari/iOS, Chrome/Android, and desktop browsers used by the pilot. Verify cold launch behavior per browser because service-worker installation, eviction, and storage policies differ. Connect and open any dashboard route once after an app update so the updated service worker can install and precache the matching offline shell.
