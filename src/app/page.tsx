import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch dashboard metrics
  const [
    { data: items },
    { data: parties },
    { data: invoices },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('items').select('id, name, current_stock, purchase_price, low_stock_threshold, unit'),
    supabase.from('parties').select('id, type, balance'),
    supabase.from('invoices').select('invoice_date, total_amount, amount_paid'),
    supabase.from('expenses').select('amount, payment_status, payment_mode'),
  ]);

  // Calculate stats
  
  // 1. You'll Get (Receivables)
  const receivables = parties
    ?.filter((p) => Number(p.balance) > 0)
    .reduce((sum, p) => sum + Number(p.balance), 0) || 0;

  // 2. You'll Give (Payables)
  const payables = parties
    ?.filter((p) => Number(p.balance) < 0)
    .reduce((sum, p) => sum + Math.abs(Number(p.balance)), 0) || 0;

  // 3. Monthly Sales
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  // Using next month's 0th day to get the last day of the current month
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const monthlySales = invoices
    ?.filter((inv) => inv.invoice_date >= currentMonthStart && inv.invoice_date <= currentMonthEnd)
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

  // 4. Cash-in-Hand
  const totalInflow = invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
  
  const totalOutflow = expenses
    ?.filter((exp) => exp.payment_status === 'paid' && ['cash', 'bank', 'upi'].includes(exp.payment_mode))
    .reduce((sum, exp) => sum + Number(exp.amount || 0), 0) || 0;

  const cashInHand = totalInflow - totalOutflow;

  // 5. Stock Value
  const stockValue = items?.reduce(
    (sum, item) => sum + Number(item.current_stock || 0) * Number(item.purchase_price || 0),
    0
  ) || 0;

  // 6. Low Stock Items
  const lowStockCount = items?.filter(
    (item) => Number(item.current_stock) <= Number(item.low_stock_threshold)
  ).length || 0;

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Live Business Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/sales/new">
          <Button
            variant="default"
            className="w-full h-auto flex-col gap-1.5 py-4 bg-primary hover:bg-primary/90"
          >
            <PlusCircle className="h-6 w-6" />
            <span className="text-xs font-medium">Add Sale</span>
          </Button>
        </Link>
        <Link href="/expenses">
          <Button
            variant="outline"
            className="w-full h-auto flex-col gap-1.5 py-4"
          >
            <Receipt className="h-6 w-6" />
            <span className="text-xs font-medium">Add Expense</span>
          </Button>
        </Link>
        <Link href="/items">
          <Button
            variant="outline"
            className="w-full h-auto flex-col gap-1.5 py-4"
          >
            <Package className="h-6 w-6" />
            <span className="text-xs font-medium">Adjust Stock</span>
          </Button>
        </Link>
        <Link href="/reports">
          <Button
            variant="outline"
            className="w-full h-auto flex-col gap-1.5 py-4"
          >
            <FileText className="h-6 w-6" />
            <span className="text-xs font-medium">View Reports</span>
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard
          title="Monthly Sales"
          value={formatCurrency(monthlySales)}
          icon={CalendarDays}
          iconClassName="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="You'll Get"
          value={formatCurrency(receivables)}
          icon={TrendingUp}
          iconClassName="bg-green-100 text-green-600"
        />
        <StatCard
          title="You'll Give"
          value={formatCurrency(payables)}
          icon={TrendingDown}
          iconClassName="bg-red-100 text-red-600"
        />
        <StatCard
          title="Cash-in-Hand"
          value={formatCurrency(cashInHand)}
          icon={Wallet}
          iconClassName="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          title="Stock Value"
          value={formatCurrency(stockValue)}
          icon={Warehouse}
          iconClassName="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockCount.toString()}
          icon={AlertTriangle}
          iconClassName="bg-amber-100 text-amber-600"
        />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Recent Transactions
            </CardTitle>
            <Link
              href="/sales"
              className="text-xs text-primary hover:underline"
            >
              View All →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RecentTransactions />
        </CardContent>
      </Card>
    </div>
  );
}

async function RecentTransactions() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, party_name, total_amount, balance_due, amount_paid')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!invoices || invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No recent transactions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv) => {
        let status = 'Unpaid';
        // 'default' (black/primary), 'secondary' (gray), 'destructive' (red)
        let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'destructive';

        if (Number(inv.balance_due) <= 0 && Number(inv.total_amount) > 0) {
          status = 'Paid';
          badgeVariant = 'default';
        } else if (Number(inv.amount_paid) > 0 && Number(inv.balance_due) > 0) {
          status = 'Partial';
          badgeVariant = 'secondary';
        } else if (Number(inv.total_amount) === 0) {
          status = 'Paid';
          badgeVariant = 'default';
        }

        return (
          <Link
            key={inv.id}
            href={`/sales/${inv.id}`}
            className="flex items-center justify-between text-sm hover:bg-muted rounded px-2 py-2 -mx-2 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">#{inv.invoice_number}</span>
                <span className="text-muted-foreground truncate">
                  {inv.party_name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="text-right flex-shrink-0 ml-2 flex flex-col items-end gap-1">
              <p className="font-semibold">
                {formatCurrency(Number(inv.total_amount))}
              </p>
              <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                {status}
              </Badge>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
