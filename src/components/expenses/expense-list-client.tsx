'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Expense } from '@/lib/supabase/types';
import { Edit, Plus, Receipt, IndianRupee, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExpenseForm } from './expense-form';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DiscardRecordDialog } from '@/components/shared/discard-record-dialog';
import { useQuery } from '@powersync/react';

interface ExpenseListClientProps {
  expenses: Array<Expense & { deleted_at?: string | null; deleted_reason?: string | null }>;
  canManageRecords: boolean;
  tenantId?: string;
}

type ExpenseSyncState = 'pending' | 'synced' | 'rejected';

type ExpenseListRow = Omit<Expense, 'business_id'> & {
  deleted_at?: string | null;
  deleted_reason?: string | null;
  sync_status?: ExpenseSyncState;
  sync_error?: string | null;
};

type ExpenseFormRecord = Pick<
  Expense,
  'id' | 'date' | 'category' | 'amount' | 'payment_status' | 'payment_mode' | 'notes' | 'created_at'
>;

type LocalExpenseStatus = {
  id: string;
  date: string;
  category: string;
  amount: number;
  payment_status: 'paid' | 'unpaid';
  payment_mode: 'cash' | 'bank' | 'upi';
  notes: string | null;
  created_at: string;
  sync_status: ExpenseSyncState;
  sync_error: string | null;
};

export function ExpenseListClient(props: ExpenseListClientProps) {
  if (props.tenantId) {
    return <TenantExpenseList {...props} tenantId={props.tenantId} />;
  }
  return <ExpenseListView {...props} />;
}

function TenantExpenseList({ expenses, tenantId, ...props }: ExpenseListClientProps & { tenantId: string }) {
  const localStatus = useQuery<LocalExpenseStatus>(
    `SELECT e.id, e.date, e.category, e.amount, e.payment_status, e.payment_mode,
            e.notes, e.created_at, s.status AS sync_status, s.error AS sync_error
     FROM expense_sync_status s
     JOIN expenses e ON e.id = s.id
     WHERE s.tenant_id = ?
     ORDER BY s.updated_at DESC`,
    [tenantId],
  );
  const localById = new Map(localStatus.data.map((expense) => [expense.id, expense]));
  const serverIds = new Set(expenses.map((expense) => expense.id));
  const rows: ExpenseListRow[] = [
    ...expenses.map((expense) => {
      const local = localById.get(expense.id);
      return {
        ...expense,
        sync_status: local?.sync_status,
        sync_error: local?.sync_error,
      };
    }),
    ...localStatus.data
      .filter((expense) => !serverIds.has(expense.id))
      .map((expense) => ({
        ...expense,
        deleted_at: null,
        deleted_reason: null,
      })),
  ];

  return (
    <ExpenseListView
      {...props}
      expenses={rows}
      tenantId={tenantId}
      syncStatusError={localStatus.error?.message ?? null}
    />
  );
}

type ExpenseListViewProps = Omit<ExpenseListClientProps, 'expenses'> & {
  expenses: ExpenseListRow[];
  syncStatusError?: string | null;
};

function ExpenseListView({
  expenses,
  canManageRecords,
  tenantId,
  syncStatusError,
}: ExpenseListViewProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseFormRecord | undefined>();
  const [newExpenseFormInstance, setNewExpenseFormInstance] = useState(0);
  const [expenseToDiscard, setExpenseToDiscard] = useState<ExpenseFormRecord | null>(null);

  const openNewExpenseForm = () => {
    setExpenseToEdit(undefined);
    setNewExpenseFormInstance((instance) => instance + 1);
    setIsFormOpen(true);
  };

  const totalExpenses = expenses
    .filter((expense) => !expense.deleted_at)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const discardExpense = async (reason: string) => {
    if (!expenseToDiscard) return;
    const response = await fetch(`/api/expenses/${expenseToDiscard.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to discard expense');
    setExpenseToDiscard(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col h-full pb-20 md:pb-0">
      <PageHeader
        title="Expenses"
        description="Manage your business expenses"
        action={
          <Button onClick={openNewExpenseForm}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      <div className="flex-1 p-4 sm:p-6 pt-0 space-y-6">
        {syncStatusError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load local expense sync statuses: {syncStatusError}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total Expenses"
            value={formatCurrency(totalExpenses)}
            icon={IndianRupee}
            className="md:col-span-1"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 p-3 rounded-full mb-4">
                  <Receipt className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium">No expenses yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mb-4">
                  Keep track of your spending by adding your first expense.
                </p>
                <Button onClick={openNewExpenseForm} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className={expense.deleted_at ? 'line-through text-muted-foreground' : ''}>
                            {formatDate(expense.date)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={expense.deleted_at ? 'font-medium line-through text-muted-foreground' : 'font-medium'}>
                            {expense.category}
                          </span>
                          {expense.deleted_at && (
                            <span className="ml-2 text-xs font-medium text-destructive">
                              Discarded{expense.deleted_reason ? `: ${expense.deleted_reason}` : ''}
                            </span>
                          )}
                          {expense.sync_status === 'pending' ? (
                            <Badge variant="secondary" className="ml-2">Pending sync</Badge>
                          ) : null}
                          {expense.sync_status === 'synced' ? (
                            <Badge variant="outline" className="ml-2">Synced</Badge>
                          ) : null}
                          {expense.sync_status === 'rejected' ? (
                            <span className="ml-2 text-xs font-medium text-destructive">
                              Rejected: {expense.sync_error || 'The server rejected this expense.'}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={expense.deleted_at ? 'outline' : 'secondary'} className={`capitalize ${expense.deleted_at ? 'line-through text-muted-foreground' : ''}`}>
                            {expense.payment_mode}
                          </Badge>
                        </TableCell>
                        <TableCell className={`max-w-[200px] truncate ${expense.deleted_at ? 'line-through text-muted-foreground' : ''}`}>
                          {expense.notes || '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${expense.deleted_at ? 'line-through text-muted-foreground' : ''}`}>
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!expense.deleted_at &&
                            (!expense.sync_status || expense.sync_status === 'synced') && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${expense.category} expense`}
                                onClick={() => {
                                  setExpenseToEdit(expense);
                                  setIsFormOpen(true);
                                }}
                              >
                                <Edit className="size-4" />
                              </Button>
                              {canManageRecords && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Discard ${expense.category} expense`}
                                  onClick={() => setExpenseToDiscard(expense)}
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ExpenseForm
        key={expenseToEdit?.id ?? `new-${newExpenseFormInstance}`}
        expense={expenseToEdit}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        tenantId={tenantId}
      />
      <DiscardRecordDialog
        open={expenseToDiscard !== null}
        onOpenChange={(open) => {
          if (!open) setExpenseToDiscard(null);
        }}
        recordName="expense"
        onConfirm={discardExpense}
      />
      
      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-20 right-4 z-10">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={openNewExpenseForm}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
