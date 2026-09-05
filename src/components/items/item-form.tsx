'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ItemForm({ 
  item, 
  open, 
  onOpenChange, 
  onSaved 
}: { 
  item?: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void 
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      unit: formData.get('unit'),
      sale_price: Number(formData.get('sale_price')),
      purchase_price: Number(formData.get('purchase_price')),
      opening_stock: Number(formData.get('opening_stock')),
      low_stock_threshold: Number(formData.get('low_stock_threshold')),
    }

    try {
      const url = item ? `/api/items/${item.id}` : '/api/items'
      const method = item ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('Failed to save')

      onSaved()
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('Error saving item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Add Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={item?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Select name="unit" defaultValue={item?.unit || 'Pcs'}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pcs">Pcs</SelectItem>
                <SelectItem value="Kg">Kg</SelectItem>
                <SelectItem value="Box">Box</SelectItem>
                <SelectItem value="Packet">Packet</SelectItem>
                <SelectItem value="Dozen">Dozen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sale_price">Sale Price (₹)</Label>
              <Input id="sale_price" name="sale_price" type="number" step="0.01" required defaultValue={item?.sale_price} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Purchase Price (₹)</Label>
              <Input id="purchase_price" name="purchase_price" type="number" step="0.01" required defaultValue={item?.purchase_price} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening_stock">Opening Stock</Label>
              <Input id="opening_stock" name="opening_stock" type="number" required defaultValue={item?.opening_stock || 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
              <Input id="low_stock_threshold" name="low_stock_threshold" type="number" required defaultValue={item?.low_stock_threshold || 0} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save Item'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
