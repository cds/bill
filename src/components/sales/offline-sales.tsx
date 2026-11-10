'use client';

import { useQuery } from '@powersync/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { OfflineInvoiceStatusList } from './offline-invoice-status';

type SyncedInvoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  party_name: string;
  payment_type: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
};

export function OfflineSales({ tenantId }: { tenantId: string }) {
  const invoices = useQuery<SyncedInvoice>(
    `SELECT id, invoice_number, invoice_date, party_name, payment_type,
            total_amount, amount_paid, balance_due
     FROM invoices
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY invoice_date DESC, invoice_number DESC
     LIMIT 100`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  return (
    <section className="space-y-6">
      {/* Locally saved offline invoices with their sync status */}
      <OfflineInvoiceStatusList tenantId={tenantId} />

      {/* Synced sales history pulled from the server */}
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold">Sales history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Locally synced sales · read-only while offline
          </p>
        </header>

        {invoices.error ? (
          <p role="alert" className="text-sm text-destructive">
            Could not read locally synced sales: {invoices.error.message}
          </p>
        ) : null}
        {invoices.isLoading ? (
          <p role="status">Loading local sales…</p>
        ) : null}
        {!invoices.isLoading && !invoices.error && invoices.data.length === 0 ? (
          <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
            No synced sales are stored on this device yet. Open Sales while online and wait for sync first.
          </p>
        ) : null}

        {invoices.data.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {invoices.data.map((invoice) => {
              const isPaid = invoice.balance_due === 0;
              const isPartial = invoice.amount_paid > 0 && invoice.balance_due > 0;
              return (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">#{invoice.invoice_number}</p>
                      {isPaid ? (
                        <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                          Paid
                        </Badge>
                      ) : isPartial ? (
                        <Badge variant="secondary">Partial</Badge>
                      ) : (
                        <Badge variant="destructive">Unpaid</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(invoice.invoice_date)} · {invoice.party_name}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">{formatCurrency(invoice.total_amount)}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
