'use client';

import { useQuery } from '@powersync/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, Package, TrendingUp, IndianRupee } from 'lucide-react';

type ItemRecord = {
  id: string;
  name: string;
  unit: string | null;
  sale_price: number | null;
  purchase_price: number | null;
  opening_stock: number | null;
  current_stock: number | null;
  low_stock_threshold: number | null;
  hsn_code: string | null;
  created_at: string;
};

export function OfflineItemDetail({
  tenantId,
  itemId,
  onBack,
}: {
  tenantId: string;
  itemId: string;
  onBack?: () => void;
}) {
  const itemQuery = useQuery<ItemRecord>(
    `SELECT * FROM items WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
    [itemId, tenantId],
    {
      streams: [{
        name: 'tenant_data',
        parameters: { tenant_id: tenantId },
      }],
    },
  );

  if (itemQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" aria-busy="true">
        <p role="status">Loading product details…</p>
      </div>
    );
  }

  const item = itemQuery.data[0];
  if (!item) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" role="alert">
        <h1 className="text-xl font-semibold">Item not found</h1>
        <p className="text-sm text-muted-foreground">
          This item was not found in local offline storage on this device.
        </p>
        <a
          href="/items"
          className="inline-flex items-center text-sm font-medium underline"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Items
        </a>
      </div>
    );
  }

  const stock = item.current_stock ?? 0;
  const isLowStock = item.low_stock_threshold !== null && stock <= item.low_stock_threshold;
  const salePrice = item.sale_price ?? 0;
  const purchasePrice = item.purchase_price ?? 0;
  const marginAmount = salePrice - purchasePrice;
  const marginPercent = purchasePrice > 0 ? ((marginAmount / purchasePrice) * 100).toFixed(1) : null;
  const estimatedStockValue = stock * purchasePrice;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <a
          href="/items"
          className="inline-flex items-center text-sm font-medium hover:underline"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Items
        </a>
        {isLowStock && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Low Stock
          </Badge>
        )}
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{item.name}</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Unit: {item.unit || 'Pcs'}</span>
          {item.hsn_code ? <span>· HSN: {item.hsn_code}</span> : null}
        </div>
      </header>

      {/* Pricing & Stock Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Sale Price</span>
              <IndianRupee className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(salePrice)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Per {item.unit || 'unit'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Purchase Price</span>
              <TrendingUp className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(purchasePrice)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {marginPercent !== null ? `${marginPercent}% margin` : 'Cost basis'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Current Stock</span>
              <Package className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${isLowStock ? 'text-destructive' : ''}`}>
              {stock} <span className="text-xs font-normal text-muted-foreground">{item.unit || ''}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Value: {formatCurrency(estimatedStockValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Inventory Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Opening Stock:</span>
            <span className="font-medium">{item.opening_stock ?? 0} {item.unit || ''}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Low Stock Threshold:</span>
            <span className="font-medium">{item.low_stock_threshold ?? 'Not set'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Gross Margin per Unit:</span>
            <span className="font-medium text-green-600">
              +{formatCurrency(Math.max(0, marginAmount))}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
