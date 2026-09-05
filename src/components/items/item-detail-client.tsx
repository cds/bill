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

interface ItemDetailClientProps {
  item: any
  stockAdjustments: any[]
}

export function ItemDetailClient({ item, stockAdjustments }: ItemDetailClientProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      
      router.push('/items')
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('Error deleting item')
      setIsDeleting(false)
    }
  }

  const stockValue = item.current_stock * item.purchase_price

  return (
    <div className="space-y-6">
      <PageHeader 
        title={item.name} 
        action={
          <div className="flex gap-2">
            <Button onClick={() => setIsAdjustOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Adjust Stock
            </Button>
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        } 
      />

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
                    <TableCell className="max-w-[200px] truncate" title={adj.notes}>{adj.notes || '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${adj.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                      {adj.type === 'add' ? '+' : '-'}{adj.quantity}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(adj.unit_cost)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(adj.quantity * adj.unit_cost)}
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
    </div>
  )
}
