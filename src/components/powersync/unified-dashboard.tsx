'use client';

import { useQuery, useStatus } from '@powersync/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  PlusCircle,
  Package,
  TrendingUp,
  TrendingDown,
  Warehouse,
  Wallet,
  CalendarDays,
  AlertTriangle,
  Receipt,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import { OfflineSyncStatus } from './offline-sync-status';

type ItemRow = {
  id: string;
  name: string;
  unit: string | null;
  current_stock: number | null;
  purchase_price: number | null;
  sale_price: number | null;
  low_stock_threshold: number | null;
};

type PartyRow = {
  id: string;
  type: string;
  balance: number | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: number;
  invoice_date: string;
  party_name: string;
  total_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  created_at: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number | null;
  payment_status: string | null;
  payment_mode: string | null;
};

export function UnifiedDashboard({ tenantId }: { tenantId: string }) {
  const status = useStatus();

  const items = useQuery<ItemRow>(
    `SELECT id, name, unit, current_stock, purchase_price, sale_price, low_stock_threshold
     FROM items
     WHERE tenant_id = ? AND deleted_at IS NULL`,
    [tenantId],
  );

  const parties = useQuery<PartyRow>(
    `SELECT id, type, balance
     FROM parties
     WHERE tenant_id = ? AND deleted_at IS NULL`,
    [tenantId],
  );

  const invoices = useQuery<InvoiceRow>(
    `SELECT id, invoice_number, invoice_date, party_name, total_amount, amount_paid, balance_due, created_at
     FROM invoices
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY invoice_date DESC, created_at DESC, invoice_number DESC`,
    [tenantId],
  );

  const expenses = useQuery<ExpenseRow>(
    `SELECT id, amount, payment_status, payment_mode
     FROM expenses
     WHERE tenant_id = ? AND deleted_at IS NULL`,
    [tenantId],
  );

  const pendingOffline = useQuery<{ count: number }>(
    `SELECT COUNT(*) AS count FROM invoice_sync_status WHERE tenant_id = ? AND status = 'pending'`,
    [tenantId],
  );

  const isLoading = items.isLoading || parties.isLoading || invoices.isLoading || expenses.isLoading;
  const error = items.error || parties.error || invoices.error || expenses.error;

  const receivables = parties.data
    .filter((p) => Number(p.balance ?? 0) > 0)
    .reduce((sum, p) => sum + Number(p.balance ?? 0), 0);

  const payables = parties.data
    .filter((p) => Number(p.balance ?? 0) < 0)
    .reduce((sum, p) => sum + Math.abs(Number(p.balance ?? 0)), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const monthlySales = invoices.data
    .filter((inv) => inv.invoice_date >= monthStart && inv.invoice_date <= monthEnd)
    .reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0);

  const totalInflow = invoices.data.reduce((sum, inv) => sum + Number(inv.amount_paid ?? 0), 0);
  const totalOutflow = expenses.data
    .filter((exp) => exp.payment_status === 'paid' && ['cash', 'bank', 'upi'].includes(exp.payment_mode ?? ''))
    .reduce((sum, exp) => sum + Number(exp.amount ?? 0), 0);
  const cashInHand = totalInflow - totalOutflow;

  const stockValue = items.data.reduce(
    (sum, item) => sum + Number(item.current_stock ?? 0) * Number(item.purchase_price ?? 0),
    0,
  );

  const lowStockCount = items.data.filter((item) => {
    const threshold = item.low_stock_threshold;
    if (threshold === null || threshold === undefined) return false;
    return Number(item.current_stock ?? 0) <= Number(threshold);
  }).length;

  const pendingCount = pendingOffline.data[0]?.count ?? 0;

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Business Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {status?.hasSynced ? 'Showing local device data (synced).' : 'Showing local device data.'}
            {pendingCount > 0 ? ` ${pendingCount} pending sync.` : ''}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <OfflineSyncStatus />
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not read local dashboard data: {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <p role="status" className="mb-6 text-sm text-muted-foreground">Loading local dashboard data…</p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/sales/new" prefetch={false}>
          <Button variant="default" className="w-full h-auto flex-col gap-1.5 py-4 bg-primary hover:bg-primary/90">
            <PlusCircle className="h-6 w-6" />
            <span className="text-xs font-medium">Add Sale</span>
          </Button>
        </Link>
        <Link href="/expenses" prefetch={false}>
          <Button variant="outline" className="w-full h-auto flex-col gap-1.5 py-4">
            <Receipt className="h-6 w-6" />
            <span className="text-xs font-medium">Add Expense</span>
          </Button>
        </Link>
        <Link href="/items" prefetch={false}>
          <Button variant="outline" className="w-full h-auto flex-col gap-1.5 py-4">
            <Package className="h-6 w-6" />
            <span className="text-xs font-medium">Adjust Stock</span>
          </Button>
        </Link>
        <Link href="/reports" prefetch={false}>
          <Button variant="outline" className="w-full h-auto flex-col gap-1.5 py-4">
            <FileText className="h-6 w-6" />
            <span className="text-xs font-medium">View Reports</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard title="Monthly Sales" value={formatCurrency(monthlySales)} icon={CalendarDays} iconClassName="bg-blue-100 text-blue-600" />
        <StatCard title="You'll Get" value={formatCurrency(receivables)} icon={TrendingUp} iconClassName="bg-green-100 text-green-600" />
        <StatCard title="You'll Give" value={formatCurrency(payables)} icon={TrendingDown} iconClassName="bg-red-100 text-red-600" />
        <StatCard title="Cash-in-Hand" value={formatCurrency(cashInHand)} icon={Wallet} iconClassName="bg-indigo-100 text-indigo-600" />
        <StatCard title="Stock Value" value={formatCurrency(stockValue)} icon={Warehouse} iconClassName="bg-purple-100 text-purple-600" />
        <StatCard title="Low Stock Items" value={lowStockCount.toString()} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Recent Transactions
            </CardTitle>
            <Link href="/sales" prefetch={false} className="text-xs text-primary hover:underline">
              View All →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recent transactions.</p>
          ) : (
            <div className="space-y-2">
              {invoices.data.slice(0, 5).map((inv) => {
                const total = Number(inv.total_amount ?? 0);
                const paid = Number(inv.amount_paid ?? 0);
                const due = Number(inv.balance_due ?? 0);
                let statusText = 'Unpaid';
                let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'destructive';
                if ((due <= 0 && total > 0) || total === 0) {
                  statusText = 'Paid';
                  badgeVariant = 'default';
                } else if (paid > 0 && due > 0) {
                  statusText = 'Partial';
                  badgeVariant = 'secondary';
                }
                return (
                  <Link
                    key={inv.id}
                    href={`/sales/${inv.id}`}
                    prefetch={false}
                    className="flex items-center justify-between text-sm hover:bg-muted rounded px-2 py-2 -mx-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{inv.invoice_number}</span>
                        <span className="text-muted-foreground truncate">{inv.party_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(inv.invoice_date)}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2 flex flex-col items-end gap-1">
                      <p className="font-semibold">{formatCurrency(total)}</p>
                      <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                        {statusText}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
