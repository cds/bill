// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineInvoiceStatusList } from '@/components/sales/offline-invoice-status';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  usePowerSyncOrNull: () => null,
}));

describe('offline invoice sync status visibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [{
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_id: 'tenant-a',
        invoice_date: '2026-11-09',
        party_id: null,
        party_name: 'Local customer',
        payment_type: 'cash',
        payment_method: 'cash',
        amount_paid: 100,
        notes: null,
        items: '[]',
        estimated_total: 100,
        created_at: '2026-11-09T10:00:00.000Z',
        sync_status: 'rejected',
        sync_error: 'Current user is not a member of this tenant',
        server_invoice_id: null,
        server_invoice_number: null,
      }],
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

  it('displays rejected pending work and the server reason for the selected tenant', async () => {
    await act(async () => {
      root.render(<OfflineInvoiceStatusList tenantId="tenant-a" />);
    });

    expect(container.textContent).toContain('Rejected');
    expect(container.textContent).toContain('Current user is not a member of this tenant');
    expect(container.textContent).toContain('Retry sync');
    const [sql, parameters] = mockUseQuery.mock.calls[0];
    expect(sql).toContain('WHERE s.tenant_id = ?');
    expect(parameters).toEqual(['tenant-a']);
  });
});
