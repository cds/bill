'use client';

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  TrendingUp,
  Package,
  Users,
  Receipt,
  ArrowLeft,
  Printer,
  Calendar,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react';

type DateFilter = 'today' | '7days' | 'month' | 'all';

function getDateRange(filter: DateFilter) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (filter === 'today') {
    return { start: todayStr, end: todayStr };
  }
  if (filter === '7days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { start: d.toISOString().split('T')[0], end: todayStr };
  }
  if (filter === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return { start: firstDay, end: todayStr };
  }
  return { start: '1970-01-01', end: '2099-12-31' };
}

export function OfflineReports({
  tenantId,
  reportType = 'hub',
  onNavigate,
}: {
  tenantId: string;
  reportType?: 'hub' | 'sales' | 'stock' | 'parties' | 'expenses';
  onNavigate?: (path: string) => void;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const { start, end } = getDateRange(dateFilter);

  // Synced data queries
  const invoicesQuery = useQuery<{
    id: string;
    invoice_number: number;
    invoice_date: string;
    party_name: string;
    payment_type: string;
    payment_method: string | null;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
  }>(
    `SELECT id, invoice_number, invoice_date, party_name, payment_type, payment_method,
            total_amount, amount_paid, balance_due
     FROM invoices
     WHERE tenant_id = ? AND deleted_at IS NULL
       AND invoice_date >= ? AND invoice_date <= ?
     ORDER BY invoice_date DESC, invoice_number DESC`,
    [tenantId, start, end],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const itemsQuery = useQuery<{
    id: string;
    name: string;
    unit: string | null;
    sale_price: number | null;
    purchase_price: number | null;
    current_stock: number | null;
    low_stock_threshold: number | null;
  }>(
    `SELECT id, name, unit, sale_price, purchase_price, current_stock, low_stock_threshold
     FROM items
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY current_stock DESC`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const partiesQuery = useQuery<{
    id: string;
    name: string;
    billing_name: string | null;
    phone: string | null;
    type: string;
    balance: number | null;
  }>(
    `SELECT id, name, billing_name, phone, type, balance
     FROM parties
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY balance DESC`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const expensesQuery = useQuery<{
    id: string;
    date: string;
    category: string;
    amount: number;
    payment_mode: string;
  }>(
    `SELECT id, date, category, amount, payment_mode
     FROM expenses
     WHERE tenant_id = ? AND deleted_at IS NULL
       AND date >= ? AND date <= ?
     ORDER BY date DESC`,
    [tenantId, start, end],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const nav = (path: string) => {
    if (onNavigate) onNavigate(path);
  };

  // Date filter pill component
  const FilterPills = () => (
    <div className="flex flex-wrap gap-1.5 print:hidden">
      {(['today', '7days', 'month', 'all'] as const).map((filter) => (
        <Button
          key={filter}
          type="button"
          size="sm"
          variant={dateFilter === filter ? 'default' : 'outline'}
          className="text-xs h-8 px-2.5"
          onClick={() => setDateFilter(filter)}
        >
          {filter === 'today' && 'Today'}
          {filter === '7days' && 'Last 7 Days'}
          {filter === 'month' && 'This Month'}
          {filter === 'all' && 'All Time'}
        </Button>
      ))}
    </div>
  );

  // 1. HUB / OVERVIEW
  if (reportType === 'hub') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <header>
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wider">Reports & Analytics</p>
          </div>
          <h1 className="mt-1 text-2xl font-bold">Offline Reports Center</h1>
          <p className="text-sm text-muted-foreground">
            Generate business intelligence and accounting statements directly from this device without internet.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => nav('/reports/sales')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Sales Report</CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Revenue analysis, payment methods, cash vs credit split, and invoice journals.</p>
              <p className="mt-3 text-xs font-medium text-primary flex items-center gap-1">
                Open Sales Report →
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => nav('/reports/stock')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Stock Valuation & Inventory</CardTitle>
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Inventory valuation at purchase cost, potential revenue, and low stock alert items.</p>
              <p className="mt-3 text-xs font-medium text-primary flex items-center gap-1">
                Open Stock Report →
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => nav('/reports/parties')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Party Ledger Statements</CardTitle>
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Accounts receivable & payable summaries, top customer dues, and ledger history.</p>
              <p className="mt-3 text-xs font-medium text-primary flex items-center gap-1">
                Open Party Statements →
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => nav('/reports/expenses')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Expense Breakdown</CardTitle>
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Categorized operational expenses, cash outflows, and monthly overhead analysis.</p>
              <p className="mt-3 text-xs font-medium text-primary flex items-center gap-1">
                Open Expense Report →
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 2. SALES REPORT
  if (reportType === 'sales') {
    const invoices = invoicesQuery.data;
    const totalSales = invoices.reduce((s, inv) => s + (inv.total_amount || 0), 0);
    const totalCollected = invoices.reduce((s, inv) => s + (inv.amount_paid || 0), 0);
    const totalDue = invoices.reduce((s, inv) => s + (inv.balance_due || 0), 0);
    const cashSales = invoices.filter((i) => i.payment_type === 'cash').reduce((s, i) => s + (i.total_amount || 0), 0);
    const creditSales = invoices.filter((i) => i.payment_type === 'credit').reduce((s, i) => s + (i.total_amount || 0), 0);

    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={() => nav('/reports')}
            className="inline-flex items-center text-sm font-medium hover:underline text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> All Reports
          </button>
          <div className="flex items-center gap-2">
            <FilterPills />
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        <header>
          <h1 className="text-2xl font-bold">Sales Analysis Report</h1>
          <p className="text-xs text-muted-foreground">
            {formatDate(start)} to {formatDate(end)} · {invoices.length} invoices recorded
          </p>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Total Sales</span>
              <p className="text-lg font-bold text-primary sm:text-xl mt-1">{formatCurrency(totalSales)}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Cash Inflow</span>
              <p className="text-lg font-bold text-green-600 sm:text-xl mt-1">{formatCurrency(totalCollected)}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Outstanding Due</span>
              <p className="text-lg font-bold text-amber-600 sm:text-xl mt-1">{formatCurrency(totalDue)}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Cash / Credit Ratio</span>
              <p className="text-xs font-semibold mt-1">Cash: {formatCurrency(cashSales)}</p>
              <p className="text-xs text-muted-foreground">Credit: {formatCurrency(creditSales)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Invoices List */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-16">Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No sales invoices in this selected date range.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-semibold">#{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell className="font-medium text-sm">{inv.party_name}</TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">{inv.payment_type}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {inv.balance_due === 0 ? (
                        <span className="text-green-600 font-medium">Paid</span>
                      ) : (
                        <span className="text-amber-600 font-medium">{formatCurrency(inv.balance_due)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // 3. STOCK VALUATION REPORT
  if (reportType === 'stock') {
    const items = itemsQuery.data;
    const totalValuation = items.reduce(
      (sum, i) => sum + (i.current_stock ?? 0) * (i.purchase_price ?? 0),
      0,
    );
    const potentialRevenue = items.reduce(
      (sum, i) => sum + (i.current_stock ?? 0) * (i.sale_price ?? 0),
      0,
    );
    const totalQty = items.reduce((sum, i) => sum + (i.current_stock ?? 0), 0);
    const lowStockItems = items.filter(
      (i) => i.low_stock_threshold !== null && (i.current_stock ?? 0) <= i.low_stock_threshold,
    );

    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <div className="flex items-center justify-between print:hidden">
          <button
            type="button"
            onClick={() => nav('/reports')}
            className="inline-flex items-center text-sm font-medium hover:underline text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> All Reports
          </button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>

        <header>
          <h1 className="text-2xl font-bold">Stock Valuation & Inventory Report</h1>
          <p className="text-xs text-muted-foreground">
            Complete inventory count and balance value stored in this device
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Stock Value (Cost)</span>
              <p className="text-lg font-bold sm:text-xl mt-1 text-primary">{formatCurrency(totalValuation)}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Potential Revenue</span>
              <p className="text-lg font-bold sm:text-xl mt-1 text-emerald-600">{formatCurrency(potentialRevenue)}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Total Units in Stock</span>
              <p className="text-lg font-bold sm:text-xl mt-1">{totalQty}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Low Stock Alert</span>
              <p className={`text-lg font-bold sm:text-xl mt-1 ${lowStockItems.length > 0 ? 'text-destructive' : ''}`}>
                {lowStockItems.length} items
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const isLow = i.low_stock_threshold !== null && (i.current_stock ?? 0) <= i.low_stock_threshold;
                const value = (i.current_stock ?? 0) * (i.purchase_price ?? 0);
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{i.name}</p>
                      {isLow && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Low stock alert
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {i.current_stock ?? 0} {i.unit || ''}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatCurrency(i.purchase_price ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatCurrency(i.sale_price ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(value)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // 4. PARTIES LEDGER REPORT
  if (reportType === 'parties') {
    const parties = partiesQuery.data;
    const receivables = parties.filter((p) => (p.balance ?? 0) > 0).reduce((s, p) => s + (p.balance ?? 0), 0);
    const payables = parties.filter((p) => (p.balance ?? 0) < 0).reduce((s, p) => s + Math.abs(p.balance ?? 0), 0);

    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <div className="flex items-center justify-between print:hidden">
          <button
            type="button"
            onClick={() => nav('/reports')}
            className="inline-flex items-center text-sm font-medium hover:underline text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> All Reports
          </button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>

        <header>
          <h1 className="text-2xl font-bold">Party Statements & Balances</h1>
          <p className="text-xs text-muted-foreground">
            Ledger summary of all customers and suppliers
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Total Receivables (You&apos;ll Get)</span>
              <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(receivables)}</p>
            </CardContent>
          </Card>
          <Card className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground">Total Payables (You&apos;ll Give)</span>
              <p className="text-xl font-bold mt-1 text-red-600">{formatCurrency(payables)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Party Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Ledger Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((p) => {
                const bal = p.balance ?? 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.billing_name || p.name}</TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">{p.type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.phone || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {bal > 0 ? (
                        <span className="text-green-600">+{formatCurrency(bal)} (Due)</span>
                      ) : bal < 0 ? (
                        <span className="text-red-600">-{formatCurrency(Math.abs(bal))} (Payable)</span>
                      ) : (
                        <span className="text-muted-foreground">Settled</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // 5. EXPENSES REPORT
  const expenses = expensesQuery.data;
  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Group by category
  const categories: Record<string, number> = {};
  for (const exp of expenses) {
    categories[exp.category] = (categories[exp.category] || 0) + (exp.amount || 0);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={() => nav('/reports')}
          className="inline-flex items-center text-sm font-medium hover:underline text-muted-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> All Reports
        </button>
        <div className="flex items-center gap-2">
          <FilterPills />
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-bold">Expense Analysis Report</h1>
        <p className="text-xs text-muted-foreground">
          {formatDate(start)} to {formatDate(end)} · Total spent: {formatCurrency(totalExpense)}
        </p>
      </header>

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(categories).slice(0, 4).map(([cat, amount]) => (
          <Card key={cat} className="p-3">
            <CardContent className="p-0">
              <span className="text-xs text-muted-foreground truncate block">{cat}</span>
              <p className="text-base font-bold text-amber-600 mt-1">{formatCurrency(amount)}</p>
              <p className="text-[11px] text-muted-foreground">
                {totalExpense > 0 ? `${((amount / totalExpense) * 100).toFixed(0)}% of total` : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  No expenses recorded in this selected date range.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell className="font-medium text-sm">{e.category}</TableCell>
                  <TableCell className="capitalize text-xs text-muted-foreground">{e.payment_mode}</TableCell>
                  <TableCell className="text-right font-semibold text-sm">{formatCurrency(e.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
