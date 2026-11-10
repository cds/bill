// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { savePartyLocally } from '@/lib/powersync/party-writes';
import { saveItemLocally } from '@/lib/powersync/item-writes';
import { OfflineReports } from '@/components/reports/offline-reports';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

describe('offline party and item local writes', () => {
  it('saves party locally into offline_parties and party_sync_status', async () => {
    const executedQueries: { sql: string; parameters: unknown[] }[] = [];
    const mockDb = {
      writeTransaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
        const mockTx = {
          execute: vi.fn(async (sql: string, parameters: unknown[]) => {
            executedQueries.push({ sql, parameters });
          }),
        };
        await cb(mockTx);
      }),
    };

    const partyId = await savePartyLocally(mockDb as never, 'tenant-123', {
      name: 'Super Foods Store',
      billing_name: 'Super Foods Pvt Ltd',
      phone: '9876543210',
      address: 'Shop 4, Main Road',
      type: 'customer',
    });

    expect(typeof partyId).toBe('string');
    expect(partyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(executedQueries).toHaveLength(3);

    // 1. offline_parties
    expect(executedQueries[0].sql).toContain('INSERT INTO offline_parties');
    expect(executedQueries[0].parameters[0]).toBe(partyId);
    expect(executedQueries[0].parameters[1]).toBe('tenant-123');
    expect(executedQueries[0].parameters[2]).toBe('Super Foods Store');

    // 2. party_sync_status
    expect(executedQueries[1].sql).toContain('INSERT INTO party_sync_status');
    expect(executedQueries[1].parameters[2]).toBe('pending');

    // 3. local parties table
    expect(executedQueries[2].sql).toContain('INSERT OR REPLACE INTO parties');
  });

  it('saves product locally into offline_items and item_sync_status', async () => {
    const executedQueries: { sql: string; parameters: unknown[] }[] = [];
    const mockDb = {
      writeTransaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
        const mockTx = {
          execute: vi.fn(async (sql: string, parameters: unknown[]) => {
            executedQueries.push({ sql, parameters });
          }),
        };
        await cb(mockTx);
      }),
    };

    const itemId = await saveItemLocally(mockDb as never, 'tenant-123', {
      name: 'Toor Dal 1kg',
      unit: 'kg',
      sale_price: 180,
      purchase_price: 150,
      opening_stock: 50,
      low_stock_threshold: 10,
      hsn_code: '0713',
    });

    expect(typeof itemId).toBe('string');
    expect(itemId).toMatch(/^[0-9a-f-]{36}$/);
    expect(executedQueries).toHaveLength(3);

    // 1. offline_items
    expect(executedQueries[0].sql).toContain('INSERT INTO offline_items');
    expect(executedQueries[0].parameters[0]).toBe(itemId);
    expect(executedQueries[0].parameters[2]).toBe('Toor Dal 1kg');

    // 2. item_sync_status
    expect(executedQueries[1].sql).toContain('INSERT INTO item_sync_status');
    expect(executedQueries[1].parameters[2]).toBe('pending');

    // 3. local items table
    expect(executedQueries[2].sql).toContain('INSERT OR REPLACE INTO items');
  });
});

describe('offline reports', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('renders sales report with KPIs and invoice table', async () => {
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM invoices')) {
        return {
          data: [{
            id: 'inv-1',
            invoice_number: 501,
            invoice_date: '2026-11-10',
            party_name: 'Metro Store',
            payment_type: 'cash',
            payment_method: 'cash',
            total_amount: 2500,
            amount_paid: 2500,
            balance_due: 0,
          }],
          isLoading: false,
          error: null,
        };
      }
      return { data: [], isLoading: false, error: null };
    });

    await act(async () => {
      root.render(<OfflineReports tenantId="tenant-123" reportType="sales" />);
    });

    expect(container.textContent).toContain('Sales Analysis Report');
    expect(container.textContent).toContain('#501');
    expect(container.textContent).toContain('Metro Store');
    expect(container.textContent).toContain('Paid');
  });

  it('renders stock valuation report with total values and low stock alerts', async () => {
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM items')) {
        return {
          data: [{
            id: 'item-1',
            name: 'Cooking Oil 1L',
            unit: 'Ltr',
            sale_price: 160,
            purchase_price: 130,
            current_stock: 3,
            low_stock_threshold: 5,
          }],
          isLoading: false,
          error: null,
        };
      }
      return { data: [], isLoading: false, error: null };
    });

    await act(async () => {
      root.render(<OfflineReports tenantId="tenant-123" reportType="stock" />);
    });

    expect(container.textContent).toContain('Stock Valuation & Inventory Report');
    expect(container.textContent).toContain('Cooking Oil 1L');
    expect(container.textContent).toContain('Low stock alert');
  });
});
