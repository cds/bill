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
    `SELECT s.id, COALESCE(s.date, e.date) AS date,
            COALESCE(s.category, e.category) AS category,
            COALESCE(s.amount, e.amount) AS amount,
            COALESCE(s.payment_status, e.payment_status) AS payment_status,
            COALESCE(s.payment_mode, e.payment_mode) AS payment_mode,
            COALESCE(s.notes, e.notes) AS notes,
            COALESCE(s.created_at, e.created_at) AS created_at,
            s.status AS sync_status, s.error AS sync_error
     FROM expense_sync_status s
     LEFT JOIN expenses e ON e.id = s.id
     WHERE s.tenant_id = ? AND COALESCE(s.category, e.category) IS NOT NULL
     ORDER BY COALESCE(s.created_at, e.created_at) DESC`,
    [tenantId],
  );

  const syncedExpenses = useQuery<OfflineExpense>(
    `SELECT id, date, category, amount, payment_status, payment_mode, notes, created_at,
            'synced' AS sync_status, NULL AS sync_error
     FROM expenses
     WHERE tenant_id = ? AND deleted_at IS NULL
       AND id NOT IN (SELECT id FROM expense_sync_status WHERE tenant_id = ?)
     ORDER BY date DESC, created_at DESC
     LIMIT 100`,
    [tenantId, tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  const pendingRows = expenses.data ?? EMPTY_EXPENSES;
  const syncedRows = syncedExpenses.data ?? EMPTY_EXPENSES;
  const pendingIds = new Set(pendingRows.map((r) => r.id));
  const uniqueSyncedRows = syncedRows.filter((r) => !pendingIds.has(r.id));
  const allRows = [...pendingRows, ...uniqueSyncedRows];

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
      {!expenses.isLoading && !expenses.error && allRows.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground" role="status">
          No expenses are stored on this device yet.
        </p>
      ) : null}

      {allRows.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {allRows.map((expense) => (
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
