'use client';

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SyncBadge } from '@/components/powersync/sync-badge';
import { OfflinePartyForm } from './offline-party-form';
import { UserPlus } from 'lucide-react';

type OfflineParty = {
  id: string;
  name: string;
  billing_name: string | null;
  phone: string | null;
  address: string | null;
  type: string;
  balance: number | null;
  sync_status: 'pending' | 'synced' | 'rejected';
};

export function OfflineParties({
  tenantId,
  onSelectParty,
}: {
  tenantId: string;
  onSelectParty?: (partyId: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);

  const parties = useQuery<OfflineParty>(
    `SELECT p.id, p.name, p.billing_name, p.phone, p.address, p.type, p.balance,
            COALESCE(s.status, 'synced') AS sync_status
     FROM parties p
     LEFT JOIN party_sync_status s ON s.id = p.id
     WHERE p.tenant_id = ? AND p.deleted_at IS NULL
     ORDER BY p.name`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  if (formOpen) {
    return (
      <OfflinePartyForm
        tenantId={tenantId}
        onSaved={(id) => {
          setFormOpen(false);
          if (onSelectParty) onSelectParty(id);
        }}
        onCancel={() => setFormOpen(false)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Parties</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Locally synced customers and suppliers · New records queue for online sync
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5" size="sm">
          <UserPlus className="h-4 w-4" /> Add Party
        </Button>
      </header>

      {parties.error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not read locally synced parties: {parties.error.message}
        </p>
      ) : null}
      {parties.isLoading ? <p role="status">Loading local parties…</p> : null}
      {!parties.isLoading && !parties.error && parties.data.length === 0 ? (
        <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
          No parties found. Create your first customer or supplier above.
        </p>
      ) : null}

      {parties.data.length > 0 ? (
        <ul className="divide-y rounded-lg border overflow-hidden">
          {parties.data.map((party) => {
            const isPending = party.sync_status === 'pending';
            return (
              <li
                key={party.id}
                className={`p-4 transition-colors ${
                  isPending
                    ? 'border-l-4 border-l-amber-500 bg-amber-50/25 dark:bg-amber-950/20 hover:bg-amber-50/50'
                    : 'hover:bg-muted/50'
                }`}
              >
                <a
                  href={`/parties/${party.id}`}
                  className="flex flex-wrap items-start justify-between gap-3"
                  onClick={(e) => {
                    if (onSelectParty) {
                      e.preventDefault();
                      onSelectParty(party.id);
                    }
                  }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{party.billing_name || party.name}</p>
                      <SyncBadge status={party.sync_status} />
                    </div>
                    <p className="text-sm capitalize text-muted-foreground">
                      {party.type}{party.phone ? ` · ${party.phone}` : ''}
                    </p>
                    {party.address ? (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {party.address}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    Balance {formatCurrency(party.balance ?? 0)}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
