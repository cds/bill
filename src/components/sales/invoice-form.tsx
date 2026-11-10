'use client';

import { useState, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, tempId } from '@/lib/utils';
import { PartySearch } from '@/components/parties/party-search';
import { LineItemRow } from './line-item-row';
import { ItemSelector } from './item-selector';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Invoice } from '@/lib/supabase/types';
import type { Item } from '@/lib/supabase/types';
import { usePowerSyncOrNull } from '@powersync/react';
import { saveInvoiceLocally } from '@/lib/powersync/invoice-writes';
import { OfflineInvoiceStatusList } from './offline-invoice-status';

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

type InvoiceFormState = {
  invoice_date: string;
  invoice_time: string;
  payment_type: 'cash' | 'credit';
  payment_method: 'cash' | 'upi' | 'bank';
  party: { id: string; name: string } | null;
  lineItems: LineItem[];
  amount_paid: number;
  notes: string;
};

type Action =
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME'; payload: string }
  | { type: 'SET_PAYMENT_TYPE'; payload: 'cash' | 'credit' }
  | { type: 'SET_PAYMENT_METHOD'; payload: string }
  | { type: 'SET_PARTY'; payload: { id: string; name: string } | null }
  | { type: 'ADD_ITEM'; payload: LineItem }
  | { type: 'UPDATE_ITEM'; payload: { tempId: string; updates: Partial<LineItem> } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'SET_AMOUNT_PAID'; payload: number }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'RESET' };

type ExistingInvoiceItem = {
  id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  discount_percent: number;
  deleted_at: string | null;
};

const getInitialState = (
  invoice?: Invoice,
  invoiceItems: ExistingInvoiceItem[] = [],
): InvoiceFormState => {
  const now = new Date();
  return {
    invoice_date: invoice?.invoice_date ?? now.toISOString().split('T')[0],
    invoice_time: now.toTimeString().slice(0, 5),
    payment_type: invoice?.payment_type ?? 'cash',
    payment_method: invoice?.payment_method ?? 'cash',
    party: invoice?.party_id ? { id: invoice.party_id, name: invoice.party_name } : null,
    lineItems: invoiceItems.filter((item) => !item.deleted_at).map((item) => ({
      tempId: tempId(),
      item_id: item.item_id,
      item_name: item.item_name,
      quantity: Number(item.quantity),
      unit: item.unit,
      rate: Number(item.rate),
      tax_percent: Number(item.tax_percent),
      discount_percent: Number(item.discount_percent),
    })),
    amount_paid: Number(invoice?.amount_paid ?? 0),
    notes: invoice?.notes ?? '',
  };
};

function reducer(state: InvoiceFormState, action: Action): InvoiceFormState {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, invoice_date: action.payload };
    case 'SET_TIME':
      return { ...state, invoice_time: action.payload };
    case 'SET_PAYMENT_TYPE':
      return { 
        ...state, 
        payment_type: action.payload,
        // Reset amount paid for cash
        amount_paid: action.payload === 'cash' ? state.amount_paid : 0 
      };
    case 'SET_PAYMENT_METHOD':
      return { ...state, payment_method: action.payload as 'cash' | 'upi' | 'bank' };
    case 'SET_PARTY':
      return { ...state, party: action.payload };
    case 'ADD_ITEM':
      return { ...state, lineItems: [...state.lineItems, action.payload] };
    case 'UPDATE_ITEM':
      return {
        ...state,
        lineItems: state.lineItems.map((item) =>
          item.tempId === action.payload.tempId
            ? { ...item, ...action.payload.updates }
            : item
        ),
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        lineItems: state.lineItems.filter((item) => item.tempId !== action.payload),
      };
    case 'SET_AMOUNT_PAID':
      return { ...state, amount_paid: action.payload };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'RESET':
      return getInitialState();
    default:
      return state;
  }
}

export function InvoiceForm({
  invoice,
  invoiceItems = [],
  itemLookupTenantId,
  onSuccess,
}: {
  invoice?: Invoice;
  invoiceItems?: ExistingInvoiceItem[];
  itemLookupTenantId?: string;
  onSuccess?: (invoiceId: string) => void;
}) {
  const router = useRouter();
  const database = usePowerSyncOrNull();
  const [state, dispatch] = useReducer(
    reducer,
    { invoice, invoiceItems },
    ({ invoice: initialInvoice, invoiceItems: initialItems }) => getInitialState(initialInvoice, initialItems),
  );
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const createOperationRef = useRef<{ payload: string; id: string } | null>(null);

  // Auto-calculations
  const itemsWithAmounts = state.lineItems.map((item) => {
    const baseAmount = item.quantity * item.rate;
    const discountAmount = baseAmount * (item.discount_percent / 100);
    const afterDiscount = baseAmount - discountAmount;
    const taxAmount = afterDiscount * (item.tax_percent / 100);

    return {
      ...item,
      amount: afterDiscount + taxAmount,
      baseAmount,
      taxAmount,
      discountAmount,
    };
  });

  const subtotal = itemsWithAmounts.reduce((total, item) => total + item.baseAmount, 0);
  const totalDiscount = itemsWithAmounts.reduce((total, item) => total + item.discountAmount, 0);
  const totalTax = itemsWithAmounts.reduce((total, item) => total + item.taxAmount, 0);
  const grandTotal = subtotal - totalDiscount + totalTax;
  
  // For cash payments, assume fully paid unless explicitly changed if we wanted, 
  // but prompt says "Payment (only shown when payment_type='credit'): Amount Received input"
  // So for cash, balance Due = 0 always by definition. We'll set amount_paid to grandTotal on submit if cash.
  const actualAmountPaid = state.payment_type === 'cash' ? grandTotal : state.amount_paid;
  const balanceDue = Math.max(0, grandTotal - actualAmountPaid);

  const handleItemQuantityChange = (
    item: Pick<Item, 'id' | 'name' | 'unit' | 'sale_price'>,
    quantity: number,
  ) => {
    const existingItem = state.lineItems.find((lineItem) => lineItem.item_id === item.id);

    if (existingItem) {
      if (quantity === 0) {
        dispatch({ type: 'REMOVE_ITEM', payload: existingItem.tempId });
      } else {
        dispatch({
          type: 'UPDATE_ITEM',
          payload: { tempId: existingItem.tempId, updates: { quantity } },
        });
      }
      return;
    }

    if (quantity > 0) {
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          tempId: tempId(),
          item_id: item.id,
          item_name: item.name,
          quantity,
          unit: item.unit,
          rate: item.sale_price || 0,
          tax_percent: 0,
          discount_percent: 0,
        },
      });
    }
  };

  const handleSave = async (saveAndNew = false) => {
    if (!state.party) {
      toast.error('Please select a party.');
      return;
    }
    if (state.lineItems.length === 0) {
      toast.error('Please add at least one item.');
      return;
    }
    if (invoice && !changeReason.trim()) {
      toast.error('Please provide a reason for changing this sale.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        invoice_date: state.invoice_date,
        party_id: state.party.id,
        party_name: state.party.name,
        payment_type: state.payment_type,
        payment_method: state.payment_method,
        subtotal,
        total_tax: totalTax,
        total_discount: totalDiscount,
        grand_total: grandTotal,
        amount_paid: actualAmountPaid,
        balance_due: balanceDue,
        notes: state.notes,
        reason: changeReason,
        items: itemsWithAmounts.map(i => ({
          item_id: i.item_id,
          item_name: i.item_name,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          tax_percent: i.tax_percent,
          discount_percent: i.discount_percent,
        }))
      };
      if (!invoice && itemLookupTenantId) {
        if (!database) {
          throw new Error('The offline invoice database is not ready. Reopen this form when the local workspace is available.');
        }

        const localInvoiceId = await saveInvoiceLocally(database, itemLookupTenantId, {
          invoice_date: state.invoice_date,
          party_id: state.party.id,
          party_name: state.party.name,
          payment_type: state.payment_type,
          payment_method: state.payment_method,
          amount_paid: actualAmountPaid,
          notes: state.notes.trim() || null,
          items: payload.items,
          estimated_total: grandTotal,
        });
        createOperationRef.current = null;
        toast.success('Sale recorded offline and queued for sync');

        if (saveAndNew) {
          dispatch({ type: 'RESET' });
        } else if (onSuccess) {
          onSuccess(localInvoiceId);
        } else {
          router.push(`/sales/${localInvoiceId}`);
        }
        return;
      }

      const serializedPayload = JSON.stringify(payload);
      if (!invoice && createOperationRef.current?.payload !== serializedPayload) {
        createOperationRef.current = { payload: serializedPayload, id: crypto.randomUUID() };
      }

      const res = await fetch(invoice ? `/api/invoices/${invoice.id}` : '/api/invoices', {
        method: invoice ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(!invoice && createOperationRef.current
            ? { 'Idempotency-Key': createOperationRef.current.id }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${invoice ? 'update' : 'save'} sale`);
      }

      const data = await res.json() as { id: string };
      if (!invoice) createOperationRef.current = null;
      
      toast.success(invoice ? 'Sale updated successfully' : 'Invoice saved successfully');
      
      if (!invoice && saveAndNew) {
        dispatch({ type: 'RESET' });
      } else if (onSuccess) {
        onSuccess(invoice?.id ?? data.id);
      } else {
        router.push(`/sales/${invoice?.id ?? data.id}`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{invoice ? `Edit Sale #${invoice.invoice_number}` : 'New Sale'}</h1>
        </div>
      </div>

      {!invoice && itemLookupTenantId ? (
        <OfflineInvoiceStatusList tenantId={itemLookupTenantId} />
      ) : null}

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input 
                  type="date" 
                  value={state.invoice_date}
                  onChange={(e) => dispatch({ type: 'SET_DATE', payload: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input 
                  type="time" 
                  value={state.invoice_time}
                  onChange={(e) => dispatch({ type: 'SET_TIME', payload: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <ToggleGroup 
                  value={[state.payment_type]} 
                  onValueChange={(val) => {
                    if (val.length > 0) dispatch({ type: 'SET_PAYMENT_TYPE', payload: val[0] as 'cash' | 'credit' });
                  }}
                  className="justify-start"
                >
                  <ToggleGroupItem value="cash" className="px-8">Cash</ToggleGroupItem>
                  <ToggleGroupItem value="credit" className="px-8">Credit</ToggleGroupItem>
                </ToggleGroup>
                
                {state.payment_type === 'cash' && (
                  <div className="pt-2 space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={state.payment_method} onValueChange={(val) => dispatch({ type: 'SET_PAYMENT_METHOD', payload: val as 'cash' | 'upi' | 'bank' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Party</Label>
              <PartySearch 
                value={state.party} 
                onSelect={(party) => dispatch({ type: 'SET_PARTY', payload: party })}
                tenantId={!invoice ? itemLookupTenantId : undefined}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
              <h3 className="font-semibold">Items</h3>
              <Button size="sm" onClick={() => setIsItemSelectorOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </div>
            
            <div className="divide-y">
              {itemsWithAmounts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No items added yet. Click &apos;Add Item&apos; to start.
                </div>
              ) : (
                itemsWithAmounts.map((item) => (
                  <LineItemRow
                    key={item.tempId}
                    item={item}
                    onUpdate={(tempId, updates) => dispatch({ type: 'UPDATE_ITEM', payload: { tempId, updates } })}
                    onRemove={(tempId) => dispatch({ type: 'REMOVE_ITEM', payload: tempId })}
                  />
                ))
              )}
            </div>
            
            <div className="p-6 bg-muted/10 flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium text-destructive">-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                {totalTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(totalTax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
                
                {state.payment_type === 'credit' && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <Label className="whitespace-nowrap">Amount Received</Label>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        className="w-32 text-right"
                        value={state.amount_paid || ''}
                        onChange={(e) => dispatch({ type: 'SET_AMOUNT_PAID', payload: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Balance Due</span>
                      <span className={balanceDue > 0 ? "text-destructive" : "text-green-600"}>
                        {formatCurrency(balanceDue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <Label>Notes (Optional)</Label>
            <Textarea 
              placeholder="Add any notes for this sale..." 
              className="mt-2"
              value={state.notes}
              onChange={(e) => dispatch({ type: 'SET_NOTES', payload: e.target.value })}
            />
          </CardContent>
        </Card>
        {invoice && (
          <Card>
            <CardContent className="p-6">
              <Label htmlFor="sale-change-reason">Reason for change (required)</Label>
              <Textarea
                id="sale-change-reason"
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                maxLength={500}
                rows={2}
                className="mt-2"
                placeholder="Explain why this sale is being changed..."
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 p-4 bg-background border-t flex justify-end gap-2 md:gap-4 z-40 md:static md:bg-transparent md:border-t-0 md:p-0">
        {!invoice && (
          <Button
            variant="outline"
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
          >
            Save & New
          </Button>
        )}
        <Button 
          onClick={() => handleSave(false)}
          disabled={isSubmitting || (Boolean(invoice) && !changeReason.trim())}
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>

      <ItemSelector 
        open={isItemSelectorOpen} 
        onOpenChange={setIsItemSelectorOpen}
        tenantId={itemLookupTenantId}
        selectedItems={state.lineItems.map(({ item_id, quantity, rate }) => ({
          itemId: item_id,
          quantity,
          rate,
        }))}
        onQuantityChange={handleItemQuantityChange}
      />
    </div>
  );
}
