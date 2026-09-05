'use client';

import { useState } from 'react';
import { Expense } from '@/lib/supabase/types';
import { Plus, Receipt, IndianRupee } from 'lucide-react';
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

interface ExpenseListClientProps {
  expenses: Expense[];
}

export function ExpenseListClient({ expenses }: ExpenseListClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="flex flex-col h-full pb-20 md:pb-0">
      <PageHeader
        title="Expenses"
        description="Manage your business expenses"
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      <div className="flex-1 p-4 sm:p-6 pt-0 space-y-6">
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
                <Button onClick={() => setIsFormOpen(true)} variant="outline">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(expense.date)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{expense.category}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {expense.payment_mode}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.notes || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.amount)}
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

      <ExpenseForm open={isFormOpen} onOpenChange={setIsFormOpen} />
      
      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-20 right-4 z-10">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setIsFormOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
