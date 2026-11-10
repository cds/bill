'use client';

import { useQuery } from '@powersync/react';
import { formatCurrency } from '@/lib/utils';

type ItemRow = {
  id: string;
  name: string;
  unit: string | null;
  current_stock: number | null;
  sale_price: number | null;
};

type PartyRow = {
  id: string;
  name: string;
  billing_name: string | null;
  phone: string | null;
  type: string;
  balance: number | null;
};

function formatQuantity(value: number | null) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function OfflineWorkspace({ tenantId }: { tenantId: string }) {
  const items = useQuery<ItemRow>(
    `SELECT id, name, unit, current_stock, sale_price
     FROM items
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY name`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );
  const parties = useQuery<PartyRow>(
    `SELECT id, name, billing_name, phone, type, balance
     FROM parties
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY name`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  if (items.error || parties.error) {
    return (
      <section className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" role="alert">
        <h1 className="text-2xl font-semibold">Could not read the offline workspace</h1>
        {items.error ? <p>Items: {items.error.message}</p> : null}
        {parties.error ? <p>Parties: {parties.error.message}</p> : null}
      </section>
    );
  }

  if (items.isLoading || parties.isLoading) {
    return (
      <section className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" aria-busy="true">
        <h1 className="text-2xl font-semibold">Offline workspace</h1>
        <p role="status">Loading locally synced items and parties…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <header>
        <p className="text-sm font-medium text-primary">Read-only · Offline capable</p>
        <h1 className="mt-1 text-2xl font-semibold">Offline workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Showing data stored on this device. Changes and new records are not available here.
        </p>
      </header>

      {items.data.length === 0 && parties.data.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
          No synced items or parties are available on this device yet. Connect while online to sync this tenant’s data.
        </p>
      ) : null}

      <section aria-labelledby="offline-items-heading" className="space-y-3">
        <h2 id="offline-items-heading" className="text-lg font-semibold">
          Items <span className="text-sm font-normal text-muted-foreground">({items.data.length})</span>
        </h2>
        {items.data.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
            No synced items are available.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.data.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatQuantity(item.current_stock)} {item.unit || ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm">Price {formatCurrency(item.sale_price ?? 0)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="offline-parties-heading" className="space-y-3">
        <h2 id="offline-parties-heading" className="text-lg font-semibold">
          Parties <span className="text-sm font-normal text-muted-foreground">({parties.data.length})</span>
        </h2>
        {parties.data.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
            No synced parties are available.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {parties.data.map((party) => (
              <li key={party.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{party.billing_name || party.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {party.type}{party.phone ? ` · ${party.phone}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm">Balance {formatCurrency(party.balance ?? 0)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
