'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

type LineItem = {
  tempId: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  discount_percent: number;
};

type LineItemRowProps = {
  item: LineItem & { amount: number };
  onUpdate: (tempId: string, updates: Partial<LineItem>) => void;
  onRemove: (tempId: string) => void;
};

export function LineItemRow({ item, onUpdate, onRemove }: LineItemRowProps) {
  return (
    <div className="p-4 grid gap-4 md:grid-cols-12 items-center">
      <div className="md:col-span-3">
        <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Item</Label>
        <div className="font-medium line-clamp-2" title={item.item_name}>{item.item_name}</div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:col-span-7">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>
          <div className="flex items-center gap-1">
            <Input 
              type="number" 
              min="0"
              step="0.01"
              value={item.quantity === 0 ? '' : item.quantity}
              onChange={(e) => onUpdate(item.tempId, { quantity: parseFloat(e.target.value) || 0 })}
              className="h-8"
            />
            <span className="text-xs text-muted-foreground w-8 truncate" title={item.unit}>{item.unit}</span>
          </div>
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Rate (₹)</Label>
          <Input 
            type="number" 
            min="0"
            step="0.01"
            value={item.rate === 0 ? '' : item.rate}
            onChange={(e) => onUpdate(item.tempId, { rate: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Disc %</Label>
          <Input 
            type="number" 
            min="0"
            max="100"
            step="0.1"
            value={item.discount_percent === 0 ? '' : item.discount_percent}
            onChange={(e) => onUpdate(item.tempId, { discount_percent: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Tax %</Label>
          <Input 
            type="number" 
            min="0"
            max="100"
            step="0.1"
            value={item.tax_percent === 0 ? '' : item.tax_percent}
            onChange={(e) => onUpdate(item.tempId, { tax_percent: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between md:justify-end md:col-span-2 gap-4">
        <div className="text-right">
          <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Amount</Label>
          <div className="font-semibold">{formatCurrency(item.amount)}</div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          onClick={() => onRemove(item.tempId)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
