'use client';

import { useQuery } from '@powersync/react';
import { formatCurrency } from '@/lib/utils';

type OfflineItem = {
  id: string;
  name: string;
  unit: string | null;
  sale_price: number | null;
  purchase_price: number | null;
  current_stock: number | null;
  low_stock_threshold: number | null;
};

export function OfflineItems({ tenantId }: { tenantId: string }) {
  const items = useQuery<OfflineItem>(
    `SELECT id, name, unit, sale_price, purchase_price, current_stock, low_stock_threshold
     FROM items
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY name`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Items</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Locally synced catalog · read-only while offline
        </p>
      </header>
      {items.error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not read locally synced items: {items.error.message}
        </p>
      ) : null}
      {items.isLoading ? <p role="status">Loading local items…</p> : null}
      {!items.isLoading && !items.error && items.data.length === 0 ? (
        <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
          No synced items are stored on this device yet. Open Items while online and wait for sync first.
        </p>
      ) : null}
      {items.data.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {items.data.map((item) => {
            const stock = item.current_stock ?? 0;
            const isLowStock = item.low_stock_threshold !== null &&
              stock <= item.low_stock_threshold;
            return (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Stock: {stock} {item.unit || ''}
                    {isLowStock ? ' · Low stock' : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p>Sale {formatCurrency(item.sale_price ?? 0)}</p>
                  <p className="text-muted-foreground">
                    Purchase {formatCurrency(item.purchase_price ?? 0)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
