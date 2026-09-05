import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';

export default async function SalesPage() {
  const supabase = await createClient();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .order('invoice_date', { ascending: false })
    .order('invoice_number', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        action={
          <Link href="/sales/new" className={buttonVariants()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Sale
          </Link>
        }
      />

      {!invoices || invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first sale to get started."
          action={
            <Link href="/sales/new" className={buttonVariants()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Sale
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {invoices.map((invoice) => {
            const isPaid = invoice.balance_due === 0;
            const isPartial = invoice.amount_paid > 0 && invoice.balance_due > 0;
            
            let statusBadge = (
              <Badge variant="destructive">Unpaid</Badge>
            );
            if (isPaid) {
              statusBadge = <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
            } else if (isPartial) {
              statusBadge = <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">Partial</Badge>;
            } else if (invoice.payment_type === 'cash') {
              statusBadge = <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
            }

            return (
              <Link key={invoice.id} href={`/sales/${invoice.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">#{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(invoice.invoice_date)}</p>
                      </div>
                      {statusBadge}
                    </div>
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{invoice.party_name}</p>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-sm text-muted-foreground capitalize">{invoice.payment_type}</p>
                      <p className="font-bold">{formatCurrency(invoice.total_amount)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
