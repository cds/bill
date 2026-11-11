import { headers } from 'next/headers';
import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { ExpenseListClient } from '@/components/expenses/expense-list-client';

export const metadata = {
  title: 'Expenses | Bill App',
  description: 'Manage your business expenses',
};

export default async function ExpensesPage() {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get('x-tenant-id');
  const canManageRecords = requestHeaders.get('x-tenant-role') === 'tenant_admin' ||
    requestHeaders.get('x-system-role') === 'super_admin';

  return (
    <DashboardTenantShell initialTenantId={tenantId}>
      {(resolvedTenantId) => (
        <ExpenseListClient
          expenses={[]}
          canManageRecords={canManageRecords}
          tenantId={resolvedTenantId}
        />
      )}
    </DashboardTenantShell>
  );
}
