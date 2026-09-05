'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface StockAdjustmentModalProps {
  item_id: string
  item_name: string
  purchase_price: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function StockAdjustmentModal({
  item_id,
  item_name,
  purchase_price,
  open,
  onOpenChange,
  onSaved,
}: StockAdjustmentModalProps) {
  const [type, setType] = useState<'add' | 'reduce'>('add')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState(purchase_price.toString())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/items/${item_id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          quantity: Number(quantity),
          date,
          unit_cost: Number(unitCost),
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to adjust stock')
      }

      // Reset form
      setQuantity('')
      setNotes('')
      setType('add')
      setDate(new Date().toISOString().split('T')[0])
      
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {item_name}</DialogTitle>
            <DialogDescription>
              Record a new stock adjustment for this item.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <div className="grid gap-2">
              <Label>Adjustment Type</Label>
              <ToggleGroup 
                value={[type]} 
                onValueChange={(val) => val.length > 0 && setType(val[0] as 'add' | 'reduce')}
                className="justify-start"
              >
                <ToggleGroupItem value="add" aria-label="Add Stock" className="data-[state=on]:bg-green-100 data-[state=on]:text-green-800">
                  Add Stock
                </ToggleGroupItem>
                <ToggleGroupItem value="reduce" aria-label="Reduce Stock" className="data-[state=on]:bg-red-100 data-[state=on]:text-red-800">
                  Reduce Stock
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unitCost">Unit Cost</Label>
              <Input
                id="unitCost"
                type="number"
                min="0"
                step="0.01"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
