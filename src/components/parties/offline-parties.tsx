'use client';

import { useQuery } from '@powersync/react';
import { formatCurrency } from '@/lib/utils';

type OfflineParty = {
  id: string;
  name: string;
  billing_name: string | null;
  phone: string | null;
  address: string | null;
  type: string;
  balance: number | null;
};

export function OfflineParties({ tenantId }: { tenantId: string }) {
  const parties = useQuery<OfflineParty>(
    `SELECT id, name, billing_name, phone, address, type, balance
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

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Parties</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Locally synced customers and suppliers · read-only while offline
        </p>
      </header>
      {parties.error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not read locally synced parties: {parties.error.message}
        </p>
      ) : null}
      {parties.isLoading ? <p role="status">Loading local parties…</p> : null}
      {!parties.isLoading && !parties.error && parties.data.length === 0 ? (
        <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
          No synced parties are stored on this device yet. Open Parties while online and wait for sync first.
        </p>
      ) : null}
      {parties.data.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {parties.data.map((party) => (
            <li key={party.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{party.billing_name || party.name}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {party.type}{party.phone ? ` · ${party.phone}` : ''}
                </p>
                {party.address ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {party.address}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm">Balance {formatCurrency(party.balance ?? 0)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
