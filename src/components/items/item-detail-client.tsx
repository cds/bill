'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ItemForm } from '@/components/items/item-form'
import { Pencil, Trash2, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StockAdjustmentModal } from '@/components/items/stock-adjustment-modal'
import { Badge } from '@/components/ui/badge'
import { DiscardRecordDialog } from '@/components/shared/discard-record-dialog'
import type { Item, StockAdjustment } from '@/lib/supabase/types'

interface ItemDetailClientProps {
  item: Item & { deleted_at: string | null; deleted_reason: string | null }
  stockAdjustments: StockAdjustment[]
  canManageRecords: boolean
}

export function ItemDetailClient({ item, stockAdjustments, canManageRecords }: ItemDetailClientProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)
  const router = useRouter()

  const handleDiscard = async (reason: string) => {
    const response = await fetch(`/api/items/${item.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Failed to discard item')
    router.refresh()
  }

  const stockValue = item.current_stock * item.purchase_price

  return (
    <div className="space-y-6">
      <PageHeader 
        title={item.name} 
        action={
          item.deleted_at ? (
            <Badge variant="destructive">Discarded</Badge>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setIsAdjustOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Adjust Stock
              </Button>
              <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              {canManageRecords && (
                <Button variant="destructive" onClick={() => setIsDiscardOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Discard
                </Button>
              )}
            </div>
          )
        } 
      />
      {item.deleted_at && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          This item is discarded{item.deleted_reason ? `: ${item.deleted_reason}` : ''}. It remains visible in history but cannot be used for new sales or stock adjustments.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sale Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(item.sale_price)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per {item.unit}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(item.purchase_price)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per {item.unit}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${item.current_stock <= item.low_stock_threshold ? 'text-destructive' : 'text-green-600'}`}>
              {item.current_stock} {item.unit}
            </div>
            {item.current_stock <= item.low_stock_threshold && (
              <p className="text-xs text-destructive mt-1">Low stock alert (threshold: {item.low_stock_threshold})</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stockValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on purchase price</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {stockAdjustments && stockAdjustments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockAdjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell>{adj.date ? formatDate(new Date(adj.date)) : formatDate(new Date(adj.created_at))}</TableCell>
                    <TableCell>
                      {adj.type === 'add' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          Add
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                          <ArrowDownRight className="w-3 h-3" />
                          Reduce
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={adj.notes ?? undefined}>{adj.notes || '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${adj.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                      {adj.type === 'add' ? '+' : '-'}{adj.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {adj.unit_cost == null ? '-' : formatCurrency(adj.unit_cost)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {adj.unit_cost == null ? '-' : formatCurrency(adj.quantity * adj.unit_cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No stock adjustments found.
            </div>
          )}
        </CardContent>
      </Card>

      {!item.deleted_at && (
        <>
          <ItemForm
            item={item}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            onSaved={() => router.refresh()}
          />

          <StockAdjustmentModal
            item_id={item.id}
            item_name={item.name}
            purchase_price={item.purchase_price}
            open={isAdjustOpen}
            onOpenChange={setIsAdjustOpen}
            onSaved={() => router.refresh()}
          />
        </>
      )}
      <DiscardRecordDialog
        open={isDiscardOpen}
        onOpenChange={setIsDiscardOpen}
        recordName="item"
        onConfirm={handleDiscard}
      />
    </div>
  )
}
