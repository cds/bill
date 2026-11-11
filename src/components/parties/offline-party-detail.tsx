'use client';

import { useQuery } from '@powersync/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Phone, MapPin, ArrowDown, ArrowUp } from 'lucide-react';

type PartyRecord = {
  id: string;
  name: string;
  billing_name: string | null;
  phone: string | null;
  address: string | null;
  type: string;
  balance: number | null;
};

type PartyInvoice = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  payment_type: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
};

export function OfflinePartyDetail({
  tenantId,
  partyId,
  onBack,
  onSelectInvoice,
}: {
  tenantId: string;
  partyId: string;
  onBack?: () => void;
  onSelectInvoice?: (invoiceId: string) => void;
}) {
  const partyQuery = useQuery<PartyRecord>(
    `SELECT * FROM parties WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
    [partyId, tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const invoicesQuery = useQuery<PartyInvoice>(
    `SELECT id, invoice_number, invoice_date, payment_type, total_amount, amount_paid, balance_due
     FROM invoices
     WHERE party_id = ? AND tenant_id = ? AND deleted_at IS NULL
     ORDER BY invoice_date DESC, invoice_number DESC`,
    [partyId, tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  if (partyQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" aria-busy="true">
        <p role="status">Loading customer details…</p>
      </div>
    );
  }

  const party = partyQuery.data[0];
  if (!party) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" role="alert">
        <h1 className="text-xl font-semibold">Party not found</h1>
        <p className="text-sm text-muted-foreground">
          This party was not found in local offline storage on this device.
        </p>
        <a
          href="/parties"
          className="inline-flex items-center text-sm font-medium underline"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Parties
        </a>
      </div>
    );
  }

  const balance = party.balance ?? 0;
  const isReceivable = balance > 0;
  const isPayable = balance < 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <a
          href="/parties"
          className="inline-flex items-center text-sm font-medium hover:underline"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Parties
        </a>
        <Badge variant="outline" className="capitalize">
          {party.type}
        </Badge>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{party.billing_name || party.name}</h1>
        {party.billing_name && party.billing_name !== party.name && (
          <p className="text-sm text-muted-foreground">Known as: {party.name}</p>
        )}
      </header>

      {/* Balance & Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current Ledger Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isReceivable ? (
                <ArrowDown className="h-5 w-5 text-green-600" />
              ) : isPayable ? (
                <ArrowUp className="h-5 w-5 text-red-600" />
              ) : null}
              <p className={`text-2xl font-bold ${isReceivable ? 'text-green-600' : isPayable ? 'text-red-600' : ''}`}>
                {formatCurrency(Math.abs(balance))}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isReceivable ? "You'll receive (receivable)" : isPayable ? "You'll pay (payable)" : 'Settled (no balance)'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {party.phone ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${party.phone}`} className="hover:underline">{party.phone}</a>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No phone recorded</p>
            )}
            {party.address ? (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="whitespace-pre-wrap text-xs">{party.address}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Invoices Ledger */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Sales Ledger{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({invoicesQuery.data.length})
          </span>
        </h2>

        {invoicesQuery.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Loading sales history…</p>
        ) : invoicesQuery.data.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No sales invoices found for this party.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {invoicesQuery.data.map((inv) => {
              const isPaid = inv.balance_due === 0;
              return (
                <li key={inv.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <a
                    href={`/sales/${inv.id}`}
                    className="flex items-center justify-between gap-4"
                    onClick={(e) => {
                      if (onSelectInvoice) {
                        e.preventDefault();
                        onSelectInvoice(inv.id);
                      }
                    }}
                  >
                    <div>
                      <p className="font-medium">Invoice #{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.invoice_date)} · {inv.payment_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(inv.total_amount)}</p>
                      <p className={`text-xs ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                        {isPaid ? 'Paid' : `Due ${formatCurrency(inv.balance_due)}`}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
