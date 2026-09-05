import { createClient } from '@/lib/supabase/server';
import { ExpenseListClient } from '@/components/expenses/expense-list-client';

export const metadata = {
  title: 'Expenses | Bill App',
  description: 'Manage your business expenses',
};

export default async function ExpensesPage() {
  const supabase = await createClient();

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    // You could return an error state component here
  }

  return <ExpenseListClient expenses={expenses || []} />;
}
