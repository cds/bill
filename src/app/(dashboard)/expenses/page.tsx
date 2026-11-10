import { createClient } from '@/lib/supabase/server';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { ExpenseListClient } from '@/components/expenses/expense-list-client';
import { headers } from 'next/headers';
import { PowerSyncProvider } from '@/lib/powersync/provider';

export const metadata = {
  title: 'Expenses | Bill App',
  description: 'Manage your business expenses',
};

export default async function ExpensesPage() {
  const supabase = await createClient();
  const tenantId = await getActiveTenantId();
  const requestHeaders = await headers();

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    // You could return an error state component here
  }

  const canManageRecords = requestHeaders.get('x-tenant-role') === 'tenant_admin' ||
    requestHeaders.get('x-system-role') === 'super_admin';

  const expenseList = (
    <ExpenseListClient
      expenses={expenses || []}
      canManageRecords={canManageRecords}
      tenantId={tenantId}
    />
  );

  return (
    <PowerSyncProvider
      tenantId={tenantId}
      fallback={<p className="p-6" role="status">Opening local expense workspace…</p>}
    >
      {expenseList}
    </PowerSyncProvider>
  );
}
