'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Item } from '@/lib/supabase/types'

type ItemCardData = Pick<Item, 'id' | 'name' | 'unit' | 'sale_price' | 'current_stock' | 'low_stock_threshold'> & {
  deleted_at?: string | null;
  deleted_reason?: string | null;
};

export function ItemCard({ item }: { item: ItemCardData }) {
  const isLowStock = item.current_stock <= (item.low_stock_threshold || 0)

  return (
    <Link href={`/items/${item.id}`}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-4 flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <span className={`font-semibold text-lg ${item.deleted_at ? 'line-through text-muted-foreground' : ''}`}>
              {item.name}
            </span>
            {item.deleted_at && (
              <span className="text-xs font-medium text-destructive">
                Discarded{item.deleted_reason ? `: ${item.deleted_reason}` : ''}
              </span>
            )}
            <div className="flex gap-2 items-center">
              <Badge variant={item.deleted_at ? 'outline' : 'secondary'} className={item.deleted_at ? 'line-through text-muted-foreground' : ''}>
                {item.unit}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Sale: {formatCurrency(item.sale_price)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`font-medium ${isLowStock ? 'text-destructive' : 'text-green-600'}`}>
              {item.current_stock} in stock
            </span>
            {isLowStock && (
              <span className="text-xs text-destructive">Low Stock</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
