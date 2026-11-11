'use client';

import { useQuery } from '@powersync/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Printer } from 'lucide-react';
import { SyncBadge } from '@/components/powersync/sync-badge';
import type { NewOfflineInvoiceItem } from '@/lib/powersync/invoice-writes';

type SyncedInvoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  party_name: string;
  payment_type: string;
  payment_method: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
};

type SyncedInvoiceItem = {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  discount_percent: number;
  amount: number;
  deleted_at: string | null;
};

type LocalOfflineInvoice = {
  id: string;
  invoice_date: string;
  party_name: string;
  payment_type: string;
  payment_method: string;
  amount_paid: number;
  notes: string | null;
  items: string;
  estimated_total: number;
  created_at: string;
  sync_status: string;
  sync_error: string | null;
  server_invoice_number: number | null;
};

export function OfflineInvoiceDetail({
  tenantId,
  invoiceId,
  onBack,
}: {
  tenantId: string;
  invoiceId: string;
  onBack?: () => void;
}) {
  const syncedInvoiceQuery = useQuery<SyncedInvoice>(
    `SELECT * FROM invoices WHERE id = ? AND tenant_id = ?`,
    [invoiceId, tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const syncedItemsQuery = useQuery<SyncedInvoiceItem>(
    `SELECT * FROM invoice_items
     WHERE invoice_id = ? AND tenant_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [invoiceId, tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const localInvoiceQuery = useQuery<LocalOfflineInvoice>(
    `SELECT i.*, s.status AS sync_status, s.error AS sync_error, s.server_invoice_number
     FROM offline_invoices i
     LEFT JOIN invoice_sync_status s ON s.id = i.id
     WHERE i.id = ? AND i.tenant_id = ?`,
    [invoiceId, tenantId],
  );

  const isLoading = syncedInvoiceQuery.isLoading || localInvoiceQuery.isLoading;
  const syncedInvoice = syncedInvoiceQuery.data[0];
  const localInvoice = localInvoiceQuery.data[0];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" aria-busy="true">
        <p role="status">Loading invoice details…</p>
      </div>
    );
  }

  if (!syncedInvoice && !localInvoice) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" role="alert">
        <h1 className="text-xl font-semibold">Invoice not found</h1>
        <p className="text-sm text-muted-foreground">
          This invoice was not found in local offline storage on this device.
        </p>
        <a
          href="/sales"
          className="inline-flex items-center text-sm font-medium underline"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sales
        </a>
      </div>
    );
  }

  // Handle local pending invoice
  if (!syncedInvoice && localInvoice) {
    let parsedItems: NewOfflineInvoiceItem[] = [];
    try {
      parsedItems = typeof localInvoice.items === 'string'
        ? (JSON.parse(localInvoice.items) as NewOfflineInvoiceItem[])
        : [];
    } catch {
      parsedItems = [];
    }

    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
        <div className="flex items-center justify-between print:hidden">
          <a
            href="/sales"
            className="inline-flex items-center text-sm font-medium hover:underline"
            onClick={(e) => {
              if (onBack) {
                e.preventDefault();
                onBack();
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sales
          </a>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print receipt
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 print:hidden">
          <span className="font-medium">
            Offline Invoice: Saved locally on this device · Queued for online sync
          </span>
          <SyncBadge status="pending" label="Pending Sync" />
        </div>

        <Card className="p-6 print:border-none print:p-0 print:shadow-none">
          <CardContent className="space-y-6 p-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">EATERA FOODS</h1>
                <p className="mt-1 text-xs text-muted-foreground">Sale Receipt</p>
              </div>
              <div className="text-right">
                <SyncBadge status="pending" label="Pending sync" />
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(localInvoice.invoice_date)}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Billed To:</p>
                <p className="font-semibold">{localInvoice.party_name}</p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                  {localInvoice.payment_type} ({localInvoice.payment_method})
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => {
                    const lineTotal = item.quantity * item.rate;
                    return (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Estimated Total:</span>
                  <span>{formatCurrency(localInvoice.estimated_total)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(localInvoice.amount_paid)}</span>
                </div>
              </div>
            </div>

            {localInvoice.notes ? (
              <p className="text-xs text-muted-foreground">
                <strong>Notes:</strong> {localInvoice.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle synced server invoice
  const items = syncedItemsQuery.data;
  const isPaid = syncedInvoice.balance_due === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex items-center justify-between print:hidden">
        <a
          href="/sales"
          className="inline-flex items-center text-sm font-medium hover:underline"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sales
        </a>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print receipt
        </Button>
      </div>

      <Card className="p-6 print:border-none print:p-0 print:shadow-none">
        <CardContent className="space-y-6 p-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">EATERA FOODS</h1>
              <p className="mt-1 text-xs text-muted-foreground">Tax Invoice / Receipt</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">#{syncedInvoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground">{formatDate(syncedInvoice.invoice_date)}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Billed To:</p>
              <p className="font-semibold">{syncedInvoice.party_name}</p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isPaid ? 'Paid' : `Due ${formatCurrency(syncedInvoice.balance_due)}`}
              </span>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {syncedInvoice.payment_type} {syncedInvoice.payment_method ? `· ${syncedInvoice.payment_method}` : ''}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const baseAmount = item.quantity * item.rate;
                  const discountAmount = baseAmount * ((item.discount_percent || 0) / 100);
                  const afterDiscount = baseAmount - discountAmount;
                  const taxAmount = afterDiscount * ((item.tax_percent || 0) / 100);
                  const lineTotal = item.amount || (afterDiscount + taxAmount);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium">{item.item_name}</p>
                        {(item.tax_percent > 0 || item.discount_percent > 0) && (
                          <p className="text-xs text-muted-foreground">
                            {item.discount_percent > 0 ? `-${item.discount_percent}% disc ` : ''}
                            {item.tax_percent > 0 ? `+${item.tax_percent}% tax` : ''}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              {syncedInvoice.subtotal !== null && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(syncedInvoice.subtotal)}</span>
                </div>
              )}
              {Boolean(syncedInvoice.tax_amount) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax:</span>
                  <span>{formatCurrency(syncedInvoice.tax_amount ?? 0)}</span>
                </div>
              )}
              {Boolean(syncedInvoice.discount_amount) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount:</span>
                  <span>-{formatCurrency(syncedInvoice.discount_amount ?? 0)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(syncedInvoice.total_amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Amount Paid:</span>
                <span>{formatCurrency(syncedInvoice.amount_paid)}</span>
              </div>
              {syncedInvoice.balance_due > 0 && (
                <div className="flex justify-between text-xs font-semibold text-amber-700">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(syncedInvoice.balance_due)}</span>
                </div>
              )}
            </div>
          </div>

          {syncedInvoice.notes ? (
            <p className="text-xs text-muted-foreground">
              <strong>Notes:</strong> {syncedInvoice.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
