'use client';

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { ExpenseForm } from './expense-form';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';

type OfflineExpense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  payment_status: 'paid' | 'unpaid';
  payment_mode: 'cash' | 'bank' | 'upi';
  notes: string | null;
  created_at: string;
  sync_status: 'pending' | 'synced' | 'rejected';
  sync_error: string | null;
};

const EMPTY_EXPENSES: OfflineExpense[] = [];

export function OfflineExpenses({ tenantId }: { tenantId: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const expenses = useQuery<OfflineExpense>(
    `SELECT e.id, e.date, e.category, e.amount, e.payment_status, e.payment_mode,
            e.notes, e.created_at, s.status AS sync_status, s.error AS sync_error
     FROM expenses e
     JOIN expense_sync_status s ON s.id = e.id
     WHERE e.tenant_id = ?
     ORDER BY e.created_at DESC`,
    [tenantId],
  );
  const rows = expenses.data ?? EMPTY_EXPENSES;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New expenses save on this device and sync when you reconnect.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>Add expense</Button>
      </header>

      {expenses.error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not read local expenses: {expenses.error.message}
        </p>
      ) : null}
      {expenses.isLoading ? <p role="status">Loading local expenses…</p> : null}
      {!expenses.isLoading && !expenses.error && rows.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
          No expenses are stored on this device yet.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {rows.map((expense) => (
            <li key={expense.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{expense.category}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(expense.date)} · {expense.payment_mode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(expense.amount)}</p>
                  <p
                    className={
                      expense.sync_status === 'rejected'
                        ? 'text-sm text-destructive'
                        : expense.sync_status === 'pending'
                          ? 'text-sm text-amber-700 dark:text-amber-400'
                          : 'text-sm text-green-700 dark:text-green-400'
                    }
                  >
                    {expense.sync_status === 'pending'
                      ? 'Pending sync'
                      : expense.sync_status === 'rejected'
                        ? 'Rejected'
                        : 'Synced'}
                  </p>
                </div>
              </div>
              {expense.notes ? (
                <p className="text-sm text-muted-foreground">{expense.notes}</p>
              ) : null}
              {expense.sync_status === 'rejected' && expense.sync_error ? (
                <p role="alert" className="text-sm text-destructive">{expense.sync_error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
      />
    </section>
  );
}
