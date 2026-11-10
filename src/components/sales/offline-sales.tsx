'use client';

import { useQuery } from '@powersync/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SyncBadge } from '@/components/powersync/sync-badge';
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

export function OfflineSales({
  tenantId,
  onSelectInvoice,
  onNewSale,
}: {
  tenantId: string;
  onSelectInvoice?: (invoiceId: string) => void;
  onNewSale?: () => void;
}) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Offline invoices and locally synced sales history
          </p>
        </div>
        {onNewSale ? (
          <Button onClick={onNewSale} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Sale
          </Button>
        ) : (
          <a
            href="/offline-app?requested=%2Fsales%2Fnew"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Sale
          </a>
        )}
      </div>

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
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <a
                    href={`/offline-app?requested=${encodeURIComponent(`/sales/${invoice.id}`)}`}
                    className="flex flex-wrap items-center justify-between gap-3"
                    onClick={(e) => {
                      if (onSelectInvoice) {
                        e.preventDefault();
                        onSelectInvoice(invoice.id);
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">#{invoice.invoice_number}</p>
                        <SyncBadge status="synced" />
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
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
