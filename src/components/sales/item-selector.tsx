'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { AlertCircle, Minus, Package, Plus, Search, ShoppingBag } from 'lucide-react';
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
  selectedItems: { itemId: string | null; quantity: number; rate: number }[];
  onQuantityChange: (item: Item, quantity: number) => void;
};

export function ItemSelector({ open, onOpenChange, selectedItems, onQuantityChange }: ItemSelectorProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || itemsLoaded) return;

    let cancelled = false;
    const loadItems = async () => {
      try {
        const res = await fetch('/api/items');
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const data: Item[] = await res.json();
        if (!cancelled) setItems(data);
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching items', error);
          setLoadError('Unable to load items.');
        }
      } finally {
        if (!cancelled) setItemsLoaded(true);
      }
    };

    void loadItems();
    return () => {
      cancelled = true;
    };
  }, [open, itemsLoaded]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSearch('');
    onOpenChange(nextOpen);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedQuantities = new Map(
    selectedItems.map(({ itemId, quantity }) => [itemId, quantity]),
  );
  const cartCount = selectedItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = selectedItems.reduce((total, item) => total + item.quantity * item.rate, 0);

  const changeQuantity = (item: Item, quantity: number) => {
    onQuantityChange(item, Math.max(0, quantity));
  };

  const Content = (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="min-h-[240px] flex-1 overflow-y-auto">
        {!itemsLoaded ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading items...</div>
        ) : loadError ? (
          <div className="p-8 text-center text-sm text-destructive">
            {loadError}{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-destructive"
              onClick={() => {
                setLoadError(null);
                setItemsLoaded(false);
              }}
            >
              Try again
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No items found.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.map(item => {
              const quantity = selectedQuantities.get(item.id) ?? 0;

              return (
                <div key={item.id} className="flex min-w-0 gap-3 rounded-xl border bg-card p-3">
                  <div
                    aria-hidden="true"
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <Package className="h-9 w-9" strokeWidth={1.5} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={item.name}>{item.name}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{item.unit}</span>
                        <span aria-hidden="true">·</span>
                        <span className={item.current_stock <= 0 ? 'text-destructive' : ''}>
                          {item.current_stock} in stock
                        </span>
                        {item.current_stock <= 0 && (
                          <AlertCircle aria-label="Out of stock" className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{formatCurrency(item.sale_price)}</span>
                      {quantity === 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 min-w-16 border-primary text-primary hover:bg-primary/10"
                          onClick={() => changeQuantity(item, 1)}
                        >
                          Add
                        </Button>
                      ) : (
                        <div className="flex h-9 items-center gap-3 rounded-md bg-primary px-1 text-primary-foreground">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove one ${item.name}`}
                            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                            onClick={() => changeQuantity(item, quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span aria-live="polite" className="min-w-4 text-center text-sm font-semibold">
                            {quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Add one ${item.name}`}
                            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                            onClick={() => changeQuantity(item, quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
            <p className="truncate text-sm text-muted-foreground">Cart total</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-bold">{formatCurrency(cartTotal)}</span>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex h-[80vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add items to sale</DialogTitle>
          </DialogHeader>
          {Content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="flex h-[90vh] flex-col">
        <SheetHeader>
          <SheetTitle>Add items to sale</SheetTitle>
        </SheetHeader>
        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          {Content}
        </div>
      </SheetContent>
    </Sheet>
  );
}
