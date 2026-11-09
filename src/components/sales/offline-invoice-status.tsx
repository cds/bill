'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, usePowerSyncOrNull } from '@powersync/react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  retryOfflineInvoice,
  type OfflineInvoiceRow,
  type OfflineInvoiceStatus,
} from '@/lib/powersync/invoice-writes';

type OfflineInvoiceQueueRow = OfflineInvoiceRow & {
  sync_status: OfflineInvoiceStatus;
  sync_error: string | null;
  server_invoice_id: string | null;
  server_invoice_number: number | null;
};

export function OfflineInvoiceStatusList({ tenantId }: { tenantId: string }) {
  const database = usePowerSyncOrNull();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const query = useQuery<OfflineInvoiceQueueRow>(
    `SELECT i.id, i.tenant_id, i.invoice_date, i.party_id, i.party_name,
            i.payment_type, i.payment_method, i.amount_paid, i.notes, i.items,
            i.estimated_total, i.created_at, s.status AS sync_status,
            s.error AS sync_error, s.server_invoice_id, s.server_invoice_number
     FROM invoice_sync_status s
     JOIN offline_invoices i ON i.id = s.id
     WHERE s.tenant_id = ?
     ORDER BY s.updated_at DESC`,
    [tenantId],
  );
  const invoices = query.data;
  if (invoices.length === 0 && !query.isLoading && !query.error) return null;

  const handleRetry = async (invoice: OfflineInvoiceQueueRow) => {
    if (!database) {
      setRetryError('The local invoice database is unavailable. Reopen this page to retry.');
      return;
    }

    setRetryingId(invoice.id);
    setRetryError(null);
    try {
      await retryOfflineInvoice(database, invoice);
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Invoice retry failed.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offline invoices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Cached stock is an estimate. The server checks current stock before accepting each invoice.
          A server invoice number appears only after acceptance.
        </p>
        {query.error ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load local invoice sync statuses: {query.error.message}
          </p>
        ) : null}
        {retryError ? (
          <p role="alert" className="text-sm text-destructive">{retryError}</p>
        ) : null}
        {query.isLoading ? <p role="status">Loading local invoice statuses...</p> : null}
        {invoices.map((invoice) => (
          <div key={invoice.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{invoice.party_name}</span>
                {invoice.sync_status === 'pending' ? (
                  <Badge variant="secondary">Pending sync</Badge>
                ) : null}
                {invoice.sync_status === 'rejected' ? (
                  <Badge variant="destructive">Rejected</Badge>
                ) : null}
                {invoice.sync_status === 'synced' && invoice.server_invoice_number !== null ? (
                  <Badge variant="outline">Invoice #{invoice.server_invoice_number}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(invoice.invoice_date)} · Estimated total {formatCurrency(invoice.estimated_total)}
                {invoice.sync_status !== 'synced' ? ` · Local ref ${invoice.id.slice(0, 8)}` : ''}
              </p>
              {invoice.sync_status === 'rejected' ? (
                <p className="text-sm text-destructive">
                  {invoice.sync_error || 'The server rejected this invoice.'}
                  {' '}Retry after resolving the issue, or create a corrected new sale.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              {invoice.sync_status === 'rejected' ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={retryingId === invoice.id}
                    onClick={() => void handleRetry(invoice)}
                  >
                    {retryingId === invoice.id ? 'Retrying...' : 'Retry sync'}
                  </Button>
                  <Link href="/sales/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    New corrected sale
                  </Link>
                </>
              ) : null}
              {invoice.sync_status === 'synced' && invoice.server_invoice_id ? (
                <Link
                  href={`/sales/${invoice.server_invoice_id}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  View invoice #{invoice.server_invoice_number}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
