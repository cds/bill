'use client';

import { useState } from 'react';
import { usePowerSyncOrNull } from '@powersync/react';
import { saveItemLocally } from '@/lib/powersync/item-writes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, PackagePlus, CloudUpload } from 'lucide-react';

const COMMON_UNITS = ['Pcs', 'kg', 'g', 'Ltr', 'ml', 'Box', 'Packet', 'Dozen', 'Bundle'];

export function OfflineItemForm({
  tenantId,
  onSaved,
  onCancel,
}: {
  tenantId: string;
  onSaved?: (itemId: string) => void;
  onCancel?: () => void;
}) {
  const database = usePowerSyncOrNull();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [openingStock, setOpeningStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [hsnCode, setHsnCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Product name is required');
      return;
    }
    const numSale = parseFloat(salePrice);
    if (isNaN(numSale) || numSale < 0) {
      setErrorMessage('Please enter a valid sale price');
      return;
    }
    if (!database) {
      setErrorMessage('Offline database is not ready. Reopen when database loads.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const itemId = await saveItemLocally(database, tenantId, {
        name,
        unit: unit || 'Pcs',
        sale_price: numSale,
        purchase_price: parseFloat(purchasePrice) || 0,
        opening_stock: parseFloat(openingStock) || 0,
        low_stock_threshold: lowStockThreshold ? parseFloat(lowStockThreshold) : null,
        hsn_code: hsnCode || null,
      });

      if (onSaved) {
        onSaved(itemId);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save product locally');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center text-sm font-medium hover:underline text-muted-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Items
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <CardTitle>Add New Product (Offline)</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Saves to local database immediately so it can be added to new invoices right away.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="item-name">Product Name *</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Basmati Rice 5kg or Tata Salt"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <Select value={unit} onValueChange={(val) => setUnit(val || 'Pcs')}>
                  <SelectTrigger id="item-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-hsn">HSN Code (Optional)</Label>
                <Input
                  id="item-hsn"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="e.g. 1006"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sale-price">Sale Price (₹) *</Label>
                <Input
                  id="sale-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="purchase-price">Purchase Price (₹)</Label>
                <Input
                  id="purchase-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Cost basis"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="opening-stock">Opening Stock</Label>
                <Input
                  id="opening-stock"
                  type="number"
                  step="1"
                  min="0"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="low-stock">Low Stock Alert Level</Label>
                <Input
                  id="low-stock"
                  type="number"
                  step="1"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="Alert below qty"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                <CloudUpload className="h-4 w-4" />
                {loading ? 'Saving...' : 'Save Product Locally'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
