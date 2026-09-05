import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { DateRangeFilter } from '@/components/reports/date-range-filter';
import { PartySelector } from '@/components/reports/party-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { PartyStatementActions } from '@/components/reports/party-statement-actions';

export default async function PartyStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const start = typeof params.start === 'string' ? params.start : undefined;
  const end = typeof params.end === 'string' ? params.end : undefined;
  const party_id = typeof params.party_id === 'string' ? params.party_id : undefined;

  const supabase = await createClient();

  // Fetch all parties for the dropdown
  const { data: parties } = await supabase
    .from('parties')
    .select('id, name')
    .order('name');

  // Fetch party details if selected
  let partyDetails = null;
  let invoices = [];
  let openingBalance = 0;
  let closingBalance = 0;

  if (party_id && start && end) {
    const { data: partyData } = await supabase
      .from('parties')
      .select('*')
      .eq('id', party_id)
      .single();
    
    partyDetails = partyData;

    // Calculate Opening Balance (sum of balance_due before start date)
    const { data: previousInvoices } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid')
      .eq('party_id', party_id)
      .lt('invoice_date', start);

    openingBalance = previousInvoices?.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0) || 0;

    // Fetch invoices for the selected period
    const { data: periodInvoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('party_id', party_id)
      .gte('invoice_date', start)
      .lte('invoice_date', end)
      .order('invoice_date', { ascending: true })
      .order('invoice_number', { ascending: true });

    invoices = periodInvoices || [];
    closingBalance = openingBalance + invoices.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="print:hidden">
        <PageHeader 
          title="Party Statement" 
          description="View ledger and statement for your customers and suppliers."
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between print:hidden">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <DateRangeFilter />
          <Suspense fallback={<div className="h-10 w-[280px] bg-muted animate-pulse rounded-md" />}>
            <PartySelector parties={parties || []} />
          </Suspense>
        </div>
        {party_id && partyDetails && start && end && (
          <PartyStatementActions 
            partyName={partyDetails.name}
            start={start}
            end={end}
            openingBalance={openingBalance}
            closingBalance={closingBalance}
            transactionsCount={invoices.length}
          />
        )}
      </div>

      {!party_id ? (
        <EmptyState
          icon={FileText}
          title="No Party Selected"
          description="Please select a party and date range to view their statement."
        />
      ) : !start || !end ? (
        <EmptyState
          icon={FileText}
          title="Select Date Range"
          description="Please select a valid date range to view the statement."
        />
      ) : (
        <div className="space-y-6">
          <Card className="print:border-none print:shadow-none">
            <CardHeader className="pb-4 print:px-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl">{partyDetails?.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Statement from {formatDate(start)} to {formatDate(end)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Closing Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(closingBalance)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="print:px-0">
              <div className="rounded-md border print:border-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Received / Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={4} className="text-right">Opening Balance</TableCell>
                      <TableCell className="text-right">{formatCurrency(openingBalance)}</TableCell>
                    </TableRow>
                    
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No transactions found in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (() => {
                        let runningBalance = openingBalance;
                        return invoices.map((inv) => {
                          const balanceDue = inv.total_amount - inv.amount_paid;
                          runningBalance += balanceDue;
                          
                          return (
                            <TableRow key={inv.id}>
                              <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                              <TableCell>INV-{inv.invoice_number.toString().padStart(4, '0')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(inv.amount_paid)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(runningBalance)}</TableCell>
                            </TableRow>
                          );
                        });
                      })()
                    )}
                    
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right">Closing Balance</TableCell>
                      <TableCell className="text-right">{formatCurrency(closingBalance)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
