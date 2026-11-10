// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@powersync/react';
import { ItemSelector } from '@/components/sales/item-selector';

vi.mock('@powersync/react', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => false,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ComponentProps<'button'> & { variant?: string; size?: string }) => {
    const { children, variant, size, ...buttonProps } = props;
    void variant;
    void size;
    return <button {...buttonProps}>{children}</button>;
  },
}));

const mockUseQuery = vi.mocked(useQuery);
let root!: Root;
let container!: HTMLDivElement;

function renderSelector(onQuantityChange = vi.fn()) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root.render(
      <ItemSelector
        open
        onOpenChange={vi.fn()}
        selectedItems={[]}
        onQuantityChange={onQuantityChange}
        tenantId="tenant-123"
      />,
    );
  });
  return onQuantityChange;
}

describe('PowerSync item selector', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.unstubAllGlobals();
  });

  it('renders locally queried items and preserves selection behavior', () => {
    const onQuantityChange = vi.fn();
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'item-1',
          name: 'Alphonso Mango',
          unit: 'Kg',
          sale_price: 240,
          current_stock: 12,
        },
        {
          id: 'item-2',
          name: 'Banana',
          unit: 'Kg',
          sale_price: 60,
          current_stock: 8,
        },
      ],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    renderSelector(onQuantityChange);

    expect(container.textContent).toContain('Alphonso Mango');
    expect(container.textContent).toContain('12 estimated');
    expect(container.textContent).toContain('₹240.00');
    expect(container.textContent).toContain('Banana');
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM items'),
      ['tenant-123'],
      {
        streams: [{
          name: 'current_tenant_items',
          parameters: { tenant_id: 'tenant-123' },
        }],
      },
    );

    act(() => {
      const searchInput = container.querySelector('input');
      if (!searchInput) throw new Error('Search input was not rendered');
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(searchInput, 'banana');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('Banana');
    expect(container.textContent).not.toContain('Alphonso Mango');

    act(() => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Add')
        ?.click();
    });

    expect(onQuantityChange).toHaveBeenCalledWith(
      {
        id: 'item-2',
        name: 'Banana',
        unit: 'Kg',
        sale_price: 60,
        current_stock: 8,
      },
      1,
    );
  });

  it('shows a loading state while the local stream has not synced', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: undefined,
    });

    renderSelector();

    expect(container.textContent).toContain('Loading items...');
  });

  it('shows an empty state when the local lookup has no matches', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    renderSelector();

    expect(container.textContent).toContain('No items found.');
  });

  it('shows PowerSync query errors instead of falling back to an API request', () => {
    vi.stubGlobal('fetch', vi.fn());
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: new Error('Local database unavailable'),
    });

    renderSelector();

    expect(container.textContent).toContain('Local database unavailable');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
