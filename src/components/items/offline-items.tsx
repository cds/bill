'use client';

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SyncBadge } from '@/components/powersync/sync-badge';
import { OfflineItemForm } from './offline-item-form';
import { PackagePlus } from 'lucide-react';

type OfflineItem = {
  id: string;
  name: string;
  unit: string | null;
  sale_price: number | null;
  purchase_price: number | null;
  current_stock: number | null;
  low_stock_threshold: number | null;
  sync_status: 'pending' | 'synced' | 'rejected';
};

export function OfflineItems({
  tenantId,
  onSelectItem,
}: {
  tenantId: string;
  onSelectItem?: (itemId: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);

  const items = useQuery<OfflineItem>(
    `SELECT i.id, i.name, i.unit, i.sale_price, i.purchase_price, i.current_stock, i.low_stock_threshold,
            COALESCE(s.status, 'synced') AS sync_status
     FROM items i
     LEFT JOIN item_sync_status s ON s.id = i.id
     WHERE i.tenant_id = ? AND i.deleted_at IS NULL
     ORDER BY i.name`,
    [tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  if (formOpen) {
    return (
      <OfflineItemForm
        tenantId={tenantId}
        onSaved={(id) => {
          setFormOpen(false);
          if (onSelectItem) onSelectItem(id);
        }}
        onCancel={() => setFormOpen(false)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Items Catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Locally synced catalog · New products queue for online sync
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5" size="sm">
          <PackagePlus className="h-4 w-4" /> Add Product
        </Button>
      </header>

      {items.error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not read locally synced items: {items.error.message}
        </p>
      ) : null}
      {items.isLoading ? <p role="status">Loading local items…</p> : null}
      {!items.isLoading && !items.error && items.data.length === 0 ? (
        <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
          No items found. Create your first product above to start billing.
        </p>
      ) : null}

      {items.data.length > 0 ? (
        <ul className="divide-y rounded-lg border overflow-hidden">
          {items.data.map((item) => {
            const stock = item.current_stock ?? 0;
            const isLowStock = item.low_stock_threshold !== null && stock <= item.low_stock_threshold;
            const isPending = item.sync_status === 'pending';

            return (
              <li
                key={item.id}
                className={`p-4 transition-colors ${
                  isPending
                    ? 'border-l-4 border-l-amber-500 bg-amber-50/25 dark:bg-amber-950/20 hover:bg-amber-50/50'
                    : 'hover:bg-muted/50'
                }`}
              >
                <a
                  href={`/items/${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3"
                  onClick={(e) => {
                    if (onSelectItem) {
                      e.preventDefault();
                      onSelectItem(item.id);
                    }
                  }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{item.name}</p>
                      <SyncBadge status={item.sync_status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stock: {stock} {item.unit || ''}
                      {isLowStock ? ' · Low stock alert' : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="font-semibold">{formatCurrency(item.sale_price ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      Cost {formatCurrency(item.purchase_price ?? 0)}
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
