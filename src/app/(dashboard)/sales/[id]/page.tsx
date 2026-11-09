import { createClient } from '@/lib/supabase/server';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { InvoiceActions } from '@/components/sales/invoice-actions';
import { headers } from 'next/headers';
import { Badge } from '@/components/ui/badge';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getActiveTenantId();
  const requestHeaders = await headers();
  const canManageRecords = requestHeaders.get('x-tenant-role') === 'tenant_admin' ||
    requestHeaders.get('x-system-role') === 'super_admin';

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (invoiceError || !invoice) {
    notFound();
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('Error fetching invoice items:', itemsError);
  }


  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/sales" className={buttonVariants({ variant: "ghost", className: "print:hidden" })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sales
        </Link>
        <InvoiceActions invoice={invoice} canManageRecords={canManageRecords} />
      </div>

      {invoice.deleted_at && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Voided sale</p>
          <p className="mt-1 text-muted-foreground">
            This sale remains in history but is excluded from active totals.
            {invoice.deleted_reason ? ` Reason: ${invoice.deleted_reason}` : ''}
          </p>
        </div>
      )}

      <Card className="p-8 print:p-0 print:border-none print:shadow-none">
        <CardContent className="p-0 space-y-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tighter">EATERA FOODS</h1>
              <p className="text-sm text-muted-foreground mt-1">Invoice / Receipt</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">#{invoice.invoice_number}</p>
              <p className="text-sm text-muted-foreground">{formatDate(invoice.invoice_date)}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Billed To:</p>
              <p className="text-lg font-semibold">{invoice.party_name}</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                invoice.payment_type === 'cash' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {invoice.payment_type === 'cash' ? 'Cash' : 'Credit'}
              </span>
              {invoice.payment_method && invoice.payment_method !== 'cash' && (
                <p className="text-xs text-muted-foreground mt-1 capitalize">{invoice.payment_method}</p>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item, index) => {
                  const baseAmount = item.quantity * item.rate;
                  const discountAmount = baseAmount * (item.discount_percent / 100);
                  const afterDiscount = baseAmount - discountAmount;
                  const taxAmount = afterDiscount * (item.tax_percent / 100);
                  const lineTotal = afterDiscount + taxAmount;
                  
                  return (
                    <TableRow key={item.id} className={item.deleted_at ? 'text-muted-foreground' : ''}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <p className={`font-medium ${item.deleted_at ? 'line-through' : ''}`}>{item.item_name}</p>
                        {item.deleted_at && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Replaced / voided
                          </Badge>
                        )}
                        {(item.tax_percent > 0 || item.discount_percent > 0) && (
                          <p className="text-xs text-muted-foreground">
                            {item.discount_percent > 0 && `-${item.discount_percent}% disc `}
                            {item.tax_percent > 0 && `+${item.tax_percent}% tax`}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity} <span className="text-xs text-muted-foreground">{item.unit}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end pt-4">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(invoice.total_amount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span>{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Balance Due</span>
                <span>{formatCurrency(invoice.balance_due)}</span>
              </div>
            </div>
          </div>
          
          {invoice.notes && (
            <div className="pt-4 text-sm">
              <p className="font-semibold mb-1">Notes</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
