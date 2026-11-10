// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineInvoiceDetail } from '@/components/sales/offline-invoice-detail';
import { OfflinePartyDetail } from '@/components/parties/offline-party-detail';
import { OfflineItemDetail } from '@/components/items/offline-item-detail';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

describe('offline detail views', () => {
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

  describe('OfflineInvoiceDetail', () => {
    it('renders synced invoice with line items, total, and balance status', async () => {
      mockUseQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM invoices')) {
          return {
            data: [{
              id: 'inv-1',
              invoice_number: 1042,
              invoice_date: '2026-11-10',
              party_name: 'Metro Retailers',
              payment_type: 'cash',
              payment_method: 'upi',
              subtotal: 1000,
              tax_amount: 180,
              discount_amount: 50,
              total_amount: 1130,
              amount_paid: 1130,
              balance_due: 0,
              notes: 'Hand delivered',
              created_at: '2026-11-10T10:00:00Z',
              deleted_at: null,
            }],
            isLoading: false,
            error: null,
          };
        }
        if (sql.includes('FROM invoice_items')) {
          return {
            data: [{
              id: 'item-row-1',
              item_name: 'Premium Basmati Rice',
              quantity: 2,
              unit: 'kg',
              rate: 500,
              tax_percent: 18,
              discount_percent: 5,
              amount: 1130,
              deleted_at: null,
            }],
            isLoading: false,
            error: null,
          };
        }
        return { data: [], isLoading: false, error: null };
      });

      await act(async () => {
        root.render(<OfflineInvoiceDetail tenantId="tenant-1" invoiceId="inv-1" />);
      });

      expect(container.textContent).toContain('#1042');
      expect(container.textContent).toContain('Metro Retailers');
      expect(container.textContent).toContain('Premium Basmati Rice');
      expect(container.textContent).toContain('Paid');
      expect(container.textContent).toContain('Print receipt');
    });
  });

  describe('OfflinePartyDetail', () => {
    it('renders party contact info, balance, and sales ledger', async () => {
      mockUseQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM parties')) {
          return {
            data: [{
              id: 'party-1',
              name: 'John Doe',
              billing_name: 'JD Enterprises',
              phone: '9876543210',
              address: '123 Market St, Pune',
              type: 'customer',
              balance: 4500,
            }],
            isLoading: false,
            error: null,
          };
        }
        if (sql.includes('FROM invoices')) {
          return {
            data: [{
              id: 'inv-1',
              invoice_number: 101,
              invoice_date: '2026-11-09',
              payment_type: 'credit',
              total_amount: 4500,
              amount_paid: 0,
              balance_due: 4500,
            }],
            isLoading: false,
            error: null,
          };
        }
        return { data: [], isLoading: false, error: null };
      });

      await act(async () => {
        root.render(<OfflinePartyDetail tenantId="tenant-1" partyId="party-1" />);
      });

      expect(container.textContent).toContain('JD Enterprises');
      expect(container.textContent).toContain('9876543210');
      expect(container.textContent).toContain('123 Market St, Pune');
      expect(container.textContent).toContain('Invoice #101');
    });
  });

  describe('OfflineItemDetail', () => {
    it('renders product pricing, gross margin %, and current stock', async () => {
      mockUseQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM items')) {
          return {
            data: [{
              id: 'item-1',
              name: 'Organic Milk',
              unit: 'Ltr',
              sale_price: 70,
              purchase_price: 50,
              opening_stock: 20,
              current_stock: 4,
              low_stock_threshold: 5,
              hsn_code: '0401',
              created_at: '2026-11-01T00:00:00Z',
            }],
            isLoading: false,
            error: null,
          };
        }
        return { data: [], isLoading: false, error: null };
      });

      await act(async () => {
        root.render(<OfflineItemDetail tenantId="tenant-1" itemId="item-1" />);
      });

      expect(container.textContent).toContain('Organic Milk');
      expect(container.textContent).toContain('HSN: 0401');
      expect(container.textContent).toContain('Low Stock');
      expect(container.textContent).toContain('40.0% margin');
    });
  });
});
