// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineItems } from '@/components/items/offline-items';
import { OfflineParties } from '@/components/parties/offline-parties';

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

describe('offline business views', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
      configurable: true,
      value: true,
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

  it('renders cached items for the selected tenant', async () => {
    mockUseQuery.mockReturnValue({
      data: [{
        id: 'item-a',
        name: 'Alphonso Mango',
        unit: 'Kg',
        sale_price: 240,
        purchase_price: 180,
        current_stock: 12,
        low_stock_threshold: 5,
      }],
      isLoading: false,
      error: undefined,
    });

    await act(async () => {
      root.render(<OfflineItems tenantId="tenant-a" />);
    });

    expect(container.textContent).toContain('Alphonso Mango');
    expect(container.textContent).toContain('Stock: 12 Kg');
    expect(container.textContent).toContain('Locally synced catalog');
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM items'),
      ['tenant-a'],
      {
        streams: [{
          name: 'tenant_data',
          parameters: { tenant_id: 'tenant-a' },
        }],
      },
    );
  });

  it('renders cached parties for the selected tenant', async () => {
    mockUseQuery.mockReturnValue({
      data: [{
        id: 'party-a',
        name: 'Acme Foods',
        billing_name: 'Acme',
        phone: '1234567890',
        address: 'Main Road',
        type: 'customer',
        balance: 500,
      }],
      isLoading: false,
      error: undefined,
    });

    await act(async () => {
      root.render(<OfflineParties tenantId="tenant-a" />);
    });

    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('customer · 1234567890');
    expect(container.textContent).toContain('Locally synced customers and suppliers');
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM parties'),
      ['tenant-a'],
      {
        streams: [{
          name: 'tenant_data',
          parameters: { tenant_id: 'tenant-a' },
        }],
      },
    );
  });
});
