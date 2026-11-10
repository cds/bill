// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineWorkspace } from '@/components/powersync/offline-workspace';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const tenantRows = [
  { id: 'item-a', tenant_id: 'tenant-a', name: 'A-only item', unit: 'pcs', current_stock: 4, sale_price: 10, deleted_at: null },
  { id: 'item-b', tenant_id: 'tenant-b', name: 'B-only item', unit: 'pcs', current_stock: 8, sale_price: 20, deleted_at: null },
  { id: 'party-a', tenant_id: 'tenant-a', name: 'A-only party', billing_name: null, phone: null, type: 'customer', balance: 0, deleted_at: null },
  { id: 'party-b', tenant_id: 'tenant-b', name: 'B-only party', billing_name: null, phone: null, type: 'customer', balance: 0, deleted_at: null },
];

describe('offline workspace tenant isolation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseQuery.mockImplementation((sql: string, parameters: string[]) => {
      // invoice_sync_status pending count — local-only table, no stream, no deleted_at
      if (sql.includes('FROM invoice_sync_status')) {
        return { data: [{ count: 0 }], isLoading: false, error: null };
      }
      return {
        data: tenantRows.filter((row) =>
          sql.includes(row.id.startsWith('item-') ? 'FROM items' : row.id.startsWith('party-') ? 'FROM parties' : 'FROM invoices') &&
          row.tenant_id === parameters[0] &&
          row.deleted_at === null,
        ),
        isLoading: false,
        error: null,
      };
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

  it("renders only the selected tenant's cached items and parties and requests that tenant's streams", async () => {
    await act(async () => {
      root.render(<OfflineWorkspace tenantId="tenant-a" />);
    });

    expect(container.textContent).toContain('A-only item');
    expect(container.textContent).toContain('A-only party');
    expect(container.textContent).not.toContain('B-only item');
    expect(container.textContent).not.toContain('B-only party');

    // Calls that query synced tables must be scoped to the tenant and use streams
    const syncedCalls = mockUseQuery.mock.calls.filter(
      ([sql]: [string]) => !sql.includes('FROM invoice_sync_status'),
    );
    for (const [sql, parameters, options] of syncedCalls) {
      expect(sql).toMatch(/WHERE tenant_id = \? AND deleted_at IS NULL/);
      expect(parameters).toEqual(['tenant-a']);
      expect(options.streams[0].parameters).toEqual({ tenant_id: 'tenant-a' });
      expect(options.streams[0].waitForStream).toBeUndefined();
    }
    // items + parties + invoices = 3 synced queries; +1 for invoice_sync_status count
    expect(mockUseQuery).toHaveBeenCalledTimes(4);
  });
});
