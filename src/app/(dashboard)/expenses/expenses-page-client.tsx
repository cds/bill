'use client';

import { DashboardTenantShell } from '@/components/powersync/dashboard-tenant-shell';
import { ExpenseListClient } from '@/components/expenses/expense-list-client';

export function ExpensesPageClient({
  initialTenantId,
  canManageRecords,
}: {
  initialTenantId?: string | null;
  canManageRecords: boolean;
}) {
  return (
    <DashboardTenantShell initialTenantId={initialTenantId}>
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
