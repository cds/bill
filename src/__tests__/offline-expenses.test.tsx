// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineExpenses } from '@/components/expenses/offline-expenses';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/components/expenses/expense-form', () => ({
  ExpenseForm: ({ tenantId }: { tenantId: string }) => (
    <p data-expense-form-tenant={tenantId}>Local expense form</p>
  ),
}));

describe('offline expense list', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pending-expense',
          date: '2026-11-10',
          category: 'Fuel',
          amount: 125.5,
          payment_status: 'paid',
          payment_mode: 'cash',
          notes: null,
          created_at: '2026-11-10T09:00:00.000Z',
          sync_status: 'pending',
          sync_error: null,
        },
        {
          id: 'rejected-expense',
          date: '2026-11-09',
          category: 'Rent',
          amount: 500,
          payment_status: 'paid',
          payment_mode: 'bank',
          notes: 'Needs review',
          created_at: '2026-11-09T09:00:00.000Z',
          sync_status: 'rejected',
          sync_error: 'Current user is not a member of this tenant',
        },
      ],
      isLoading: false,
      error: null,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('shows local pending and rejected expenses and scopes the query to the tenant', async () => {
    await act(async () => root.render(<OfflineExpenses tenantId="tenant-a" />));

    expect(container.textContent).toContain('Pending sync');
    expect(container.textContent).toContain('Rejected');
    expect(container.textContent).toContain('Current user is not a member of this tenant');
    expect(container.querySelector('[data-expense-form-tenant="tenant-a"]')).not.toBeNull();

    const [sql, parameters] = mockUseQuery.mock.calls[0];
    expect(sql).toContain('WHERE e.tenant_id = ?');
    expect(parameters).toEqual(['tenant-a']);
  });
});
