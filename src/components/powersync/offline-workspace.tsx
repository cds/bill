'use client';

import { useQuery } from '@powersync/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  AlertTriangle,
  PlusCircle,
  Receipt,
  Users,
} from 'lucide-react';

type ItemRow = {
  id: string;
  name: string;
  unit: string | null;
  current_stock: number | null;
  sale_price: number | null;
  purchase_price: number | null;
  low_stock_threshold: number | null;
};

type PartyRow = {
  id: string;
  name: string;
  billing_name: string | null;
  phone: string | null;
  type: string;
  balance: number | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  party_name: string;
  total_amount: number;
  balance_due: number;
};

function formatQuantity(value: number | null) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function OfflineWorkspace({
  tenantId,
  onNavigate,
}: {
  tenantId: string;
  onNavigate?: (path: string) => void;
}) {
  const items = useQuery<ItemRow>(
    `SELECT id, name, unit, current_stock, sale_price, purchase_price, low_stock_threshold
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

  const invoices = useQuery<InvoiceRow>(
    `SELECT id, invoice_number, invoice_date, party_name, total_amount, balance_due
     FROM invoices
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY invoice_date DESC, invoice_number DESC
     LIMIT 20`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  // Count pending offline invoices not yet synced
  const pendingOffline = useQuery<{ count: number }>(
    `SELECT COUNT(*) AS count FROM invoice_sync_status WHERE tenant_id = ? AND status = 'pending'`,
    [tenantId],
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
        <p role="status">Loading locally synced data…</p>
      </section>
    );
  }

  const pendingCount = pendingOffline.data[0]?.count ?? 0;

  // Calculate live offline KPIs
  const receivables = parties.data
    .filter((p) => (p.balance ?? 0) > 0)
    .reduce((sum, p) => sum + (p.balance ?? 0), 0);

  const payables = parties.data
    .filter((p) => (p.balance ?? 0) < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance ?? 0), 0);

  const totalStockValue = items.data
    .filter((i) => (i.current_stock ?? 0) > 0 && (i.purchase_price ?? 0) > 0)
    .reduce((sum, i) => sum + (i.current_stock ?? 0) * (i.purchase_price ?? 0), 0);

  const lowStockCount = items.data.filter(
    (i) => i.low_stock_threshold !== null && (i.current_stock ?? 0) <= i.low_stock_threshold,
  ).length;

  const handleLink = (path: string) => (e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Offline Mode · Local Device Storage
          </p>
          <h1 className="mt-1 text-2xl font-bold">Business Workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fast, local operations. Sales and expenses recorded here sync automatically when connected.
          </p>
        </div>
      </header>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a
          href="/offline-app?requested=%2Fsales%2Fnew"
          onClick={handleLink('/sales/new')}
          className="flex items-center gap-2 rounded-lg border bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span>New Sale</span>
        </a>
        <a
          href="/offline-app?requested=%2Fexpenses"
          onClick={handleLink('/expenses')}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Receipt className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Add Expense</span>
        </a>
        <a
          href="/offline-app?requested=%2Fitems"
          onClick={handleLink('/items')}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Package className="h-4 w-4 shrink-0 text-blue-600" />
          <span>Items Catalog</span>
        </a>
        <a
          href="/offline-app?requested=%2Fparties"
          onClick={handleLink('/parties')}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Users className="h-4 w-4 shrink-0 text-purple-600" />
          <span>Parties & Ledger</span>
        </a>
      </div>

      {/* Live Business KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">You&apos;ll Get</span>
              <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
            </div>
            <p className="mt-1 text-lg font-bold text-green-600 sm:text-xl">
              {formatCurrency(receivables)}
            </p>
            <p className="text-[11px] text-muted-foreground">Customer dues</p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">You&apos;ll Give</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
            </div>
            <p className="mt-1 text-lg font-bold text-red-600 sm:text-xl">
              {formatCurrency(payables)}
            </p>
            <p className="text-[11px] text-muted-foreground">Supplier dues</p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Stock Value</span>
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="mt-1 text-lg font-bold sm:text-xl">
              {formatCurrency(totalStockValue)}
            </p>
            <p className="text-[11px] text-muted-foreground">{items.data.length} total items</p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Low Stock</span>
              <AlertTriangle className={`h-3.5 w-3.5 ${lowStockCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
            </div>
            <p className={`mt-1 text-lg font-bold sm:text-xl ${lowStockCount > 0 ? 'text-amber-600' : ''}`}>
              {lowStockCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Need reorder</p>
          </CardContent>
        </Card>
      </div>

      {items.data.length === 0 && parties.data.length === 0 && invoices.data.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
          No synced data is available on this device yet. Connect while online to sync this tenant&apos;s data.
        </p>
      ) : null}

      {/* Recent Sales Section */}
      <section aria-labelledby="offline-sales-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="offline-sales-heading" className="flex items-center gap-2 text-lg font-semibold">
            <span>Recent Sales</span>
            <span className="text-sm font-normal text-muted-foreground">({invoices.data.length})</span>
            {pendingCount > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {pendingCount} pending sync
              </Badge>
            ) : null}
          </h2>
          <a
            href="/offline-app?requested=%2Fsales"
            onClick={handleLink('/sales')}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </a>
        </div>
        {invoices.data.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
            No synced sales are available.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {invoices.data.slice(0, 6).map((invoice) => {
              const isPaid = invoice.balance_due === 0;
              return (
                <li key={invoice.id} className="p-3.5 hover:bg-muted/50 transition-colors">
                  <a
                    href={`/offline-app?requested=${encodeURIComponent(`/sales/${invoice.id}`)}`}
                    onClick={handleLink(`/sales/${invoice.id}`)}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">#{invoice.invoice_number} · {invoice.party_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(invoice.invoice_date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatCurrency(invoice.total_amount)}</p>
                      <p className={`text-xs ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                        {isPaid ? 'Paid' : `Due ${formatCurrency(invoice.balance_due)}`}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Items Summary Section */}
      <section aria-labelledby="offline-items-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="offline-items-heading" className="text-lg font-semibold">
            Items Catalog <span className="text-sm font-normal text-muted-foreground">({items.data.length})</span>
          </h2>
          <a
            href="/offline-app?requested=%2Fitems"
            onClick={handleLink('/items')}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </a>
        </div>
        {items.data.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
            No synced items are available.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.data.slice(0, 5).map((item) => (
              <li key={item.id} className="p-3.5 hover:bg-muted/50 transition-colors">
                <a
                  href={`/offline-app?requested=${encodeURIComponent(`/items/${item.id}`)}`}
                  onClick={handleLink(`/items/${item.id}`)}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock: {formatQuantity(item.current_stock)} {item.unit || ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatCurrency(item.sale_price ?? 0)}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Parties Summary Section */}
      <section aria-labelledby="offline-parties-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="offline-parties-heading" className="text-lg font-semibold">
            Parties <span className="text-sm font-normal text-muted-foreground">({parties.data.length})</span>
          </h2>
          <a
            href="/offline-app?requested=%2Fparties"
            onClick={handleLink('/parties')}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </a>
        </div>
        {parties.data.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
            No synced parties are available.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {parties.data.slice(0, 5).map((party) => (
              <li key={party.id} className="p-3.5 hover:bg-muted/50 transition-colors">
                <a
                  href={`/offline-app?requested=${encodeURIComponent(`/parties/${party.id}`)}`}
                  onClick={handleLink(`/parties/${party.id}`)}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{party.billing_name || party.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {party.type}{party.phone ? ` · ${party.phone}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">Balance {formatCurrency(party.balance ?? 0)}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
