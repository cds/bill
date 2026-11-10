import 'client-only';

import type { CommonPowerSyncDatabase } from '@powersync/web';

export type NewOfflineExpense = {
  date: string;
  category: string;
  amount: number;
  payment_mode: 'cash' | 'bank' | 'upi';
  notes: string | null;
};

export async function saveExpenseLocally(
  database: CommonPowerSyncDatabase,
  tenantId: string,
  expense: NewOfflineExpense,
) {
  if (!tenantId.trim()) {
    throw new Error('A tenant ID is required to save an offline expense.');
  }
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('This browser does not support secure UUID generation for offline expenses.');
  }

  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();

  await database.writeTransaction(async (transaction) => {
    await transaction.execute(
      `INSERT INTO expenses
        (id, tenant_id, date, category, amount, payment_status, payment_mode, notes, created_at)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?)`,
      [
        id,
        tenantId,
        expense.date,
        expense.category,
        expense.amount,
        expense.payment_mode,
        expense.notes,
        now,
      ],
    );
    await transaction.execute(
      `INSERT INTO expense_sync_status
        (id, tenant_id, date, category, amount, payment_status, payment_mode, notes,
         created_at, status, error, updated_at)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, 'pending', NULL, ?)`,
      [
        id,
        tenantId,
        expense.date,
        expense.category,
        expense.amount,
        expense.payment_mode,
        expense.notes,
        now,
        now,
      ],
    );
  });

  return id;
}

export async function setExpenseSyncStatus(
  database: CommonPowerSyncDatabase,
  expenseId: string,
  tenantId: string | null,
  status: 'pending' | 'synced' | 'rejected',
  error: string | null,
) {
  const updatedAt = new Date().toISOString();
  if (tenantId) {
    await database.execute(
      `UPDATE expense_sync_status
       SET status = ?, error = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [status, error, updatedAt, expenseId, tenantId],
    );
    return;
  }

  await database.execute(
    `UPDATE expense_sync_status
     SET status = ?, error = ?, updated_at = ?
     WHERE id = ?`,
    [status, error, updatedAt, expenseId],
  );
}
