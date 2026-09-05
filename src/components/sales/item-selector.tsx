'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Search, AlertCircle } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';

type Item = {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
  current_stock: number;
};

type ItemSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: Item) => void;
};

export function ItemSelector({ open, onOpenChange, onSelect }: ItemSelectorProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchItems();
    } else {
      setSearch('');
    }
  }, [open]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching items', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (item: Item) => {
    onSelect(item);
    onOpenChange(false);
  };

  const Content = (
    <div className="flex flex-col h-full space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-md divide-y">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No items found.</div>
        ) : (
          filteredItems.map(item => (
            <button
              key={item.id}
              className="w-full p-3 flex justify-between items-center text-left hover:bg-muted/50 transition-colors"
              onClick={() => handleSelect(item)}
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${item.current_stock <= 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    Stock: {item.current_stock} {item.unit}
                  </span>
                  {item.current_stock <= 0 && (
                    <AlertCircle className="w-3 h-3 text-destructive" />
                  )}
                </div>
              </div>
              <div className="font-semibold text-right">
                {formatCurrency(item.sale_price)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Item</DialogTitle>
          </DialogHeader>
          {Content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Select Item</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-hidden">
          {Content}
        </div>
      </SheetContent>
    </Sheet>
  );
}
