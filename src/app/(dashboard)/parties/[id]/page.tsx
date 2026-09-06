import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, MapPin, Phone, Pencil, Trash } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { FileText } from 'lucide-react';

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: party, error: partyError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', id)
    .single();

  if (partyError || !party) {
    notFound();
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .eq('party_id', id)
    .order('invoice_date', { ascending: false });

  const renderBalance = (balance: number) => {
    if (!balance || balance === 0)
      return <span className="text-gray-500 font-bold text-2xl">₹0</span>;
    if (balance > 0) {
      return (
        <span className="text-green-600 flex items-center font-bold text-2xl">
          <ArrowUp className="w-6 h-6 mr-1" />
          {formatCurrency(balance)}
        </span>
      );
    }
    return (
      <span className="text-red-600 flex items-center font-bold text-2xl">
        <ArrowDown className="w-6 h-6 mr-1" />
        {formatCurrency(Math.abs(balance))}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <PageHeader
        title={party.name}
        action={
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm">
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Badge variant={party.type === 'customer' ? 'default' : 'secondary'}>
                {party.type === 'customer' ? 'Customer' : 'Supplier'}
              </Badge>
            </div>
            {party.phone && (
              <div className="flex items-center text-gray-600">
                <Phone className="w-4 h-4 mr-2" />
                {party.phone}
              </div>
            )}
            {party.address && (
              <div className="flex items-start text-gray-600">
                <MapPin className="w-4 h-4 mr-2 mt-1" />
                <p className="whitespace-pre-wrap">{party.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center h-32">
            {renderBalance(party.balance || 0)}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Recent Invoices</h2>
        {(!invoices || invoices.length === 0) ? (
          <EmptyState
            icon={FileText}
            title="No invoices"
            description="No invoices found for this party."
          />
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const isPaid = inv.payment_type === 'cash' || Number(inv.balance_due) === 0;
                  const isPartial = Number(inv.amount_paid) > 0 && Number(inv.balance_due) > 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">#{inv.invoice_number}</TableCell>
                      <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell>
                        <Badge variant={isPaid ? 'default' : isPartial ? 'secondary' : 'destructive'}>
                          {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
