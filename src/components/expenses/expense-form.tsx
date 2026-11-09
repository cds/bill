'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Expense } from '@/lib/supabase/types';
import { usePowerSyncOrNull } from '@powersync/react';
import { saveExpenseLocally } from '@/lib/powersync/expense-writes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  'Diesel',
  'Salary',
  'Rent',
  'Vehicle Maintenance',
  'Manufacturing',
  'Tea',
  'Miscellaneous',
];

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Pick<Expense, 'id' | 'date' | 'category' | 'amount' | 'payment_status' | 'payment_mode' | 'notes' | 'created_at'>;
  tenantId?: string;
}

export function ExpenseForm({ open, onOpenChange, expense, tenantId }: ExpenseFormProps) {
  const router = useRouter();
  const database = usePowerSyncOrNull();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get('date'),
      category: formData.get('category'),
      amount: formData.get('amount'),
      payment_mode: formData.get('payment_mode'),
      notes: formData.get('notes'),
      reason: formData.get('reason'),
    };

    try {
      if (!expense && tenantId) {
        if (!database) {
          throw new Error('The offline database is not ready. Reopen this form when the local workspace is available.');
        }

        const amount = Number(data.amount);
        const category = typeof data.category === 'string' ? data.category.trim() : '';
        const date = typeof data.date === 'string' ? data.date : '';
        const paymentMode = data.payment_mode;
        const notes = typeof data.notes === 'string' ? data.notes.trim() || null : null;
        if (
          !date ||
          !category ||
          !Number.isFinite(amount) ||
          amount < 0 ||
          (paymentMode !== 'cash' && paymentMode !== 'bank' && paymentMode !== 'upi')
        ) {
          throw new Error('Enter a valid date, category, amount, and payment mode.');
        }

        await saveExpenseLocally(database, tenantId, {
          date,
          category,
          amount,
          payment_mode: paymentMode,
          notes,
        });
        onOpenChange(false);
        return;
      }

      const res = await fetch(expense ? `/api/expenses/${expense.id}` : '/api/expenses', {
        method: expense ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to ${expense ? 'update' : 'create'} expense`);
      }

      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription>
            {expense ? 'Update this expense and record why it changed.' : 'Enter the details of your new expense.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          {error && <div className="text-sm text-red-500 font-medium">{error}</div>}
          
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={expense?.date ?? new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select name="category" required defaultValue={expense?.category}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_mode">Payment Mode</Label>
            <Select name="payment_mode" required defaultValue={expense?.payment_mode ?? 'cash'}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Optional notes..."
              className="resize-none"
              rows={3}
              defaultValue={expense?.notes ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              defaultValue={expense?.amount}
            />
          </div>

          {expense && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for change (required)</Label>
              <Textarea id="reason" name="reason" required maxLength={500} rows={2} />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : expense ? 'Update Expense' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
