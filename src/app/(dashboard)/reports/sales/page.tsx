import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/supabase/tenant-context'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { PrintButton } from '@/components/shared/print-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IndianRupee, FileText, Activity } from 'lucide-react'

export default async function SalesReportPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const start = resolvedParams.start as string | undefined
  const end = resolvedParams.end as string | undefined

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  let query = supabase
    .from('invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('invoice_date', { ascending: false })

  if (start) {
    query = query.gte('invoice_date', start)
  }
  if (end) {
    query = query.lte('invoice_date', end)
  }

  const { data: invoices, error } = await query
  if (error) {
    throw new Error(`Failed to load sales report: ${error.message}`)
  }

  const safeInvoices = invoices || []

  const activeInvoices = safeInvoices.filter((invoice) => !invoice.deleted_at)
  const totalSales = activeInvoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0)
  const totalPaid = activeInvoices.reduce((acc, inv) => acc + Number(inv.amount_paid), 0)
  const totalBalance = activeInvoices.reduce((acc, inv) => acc + Number(inv.balance_due), 0)

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader 
          title="Sales Report" 
          action={<PrintButton />}
        />
        <div className="mt-4 mb-6">
          <DateRangeFilter />
        </div>
      </div>

      <div className="hidden print:block text-2xl font-bold mb-4">
        Sales Report {start && end ? `(${formatDate(start)} - ${formatDate(end)})` : ''}
      </div>

      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
        <StatCard
          title="Total Sales"
          value={formatCurrency(totalSales)}
          icon={Activity}
        />
        <StatCard
          title="Amount Paid"
          value={formatCurrency(totalPaid)}
          icon={IndianRupee}
        />
        <StatCard
          title="Balance Due"
          value={formatCurrency(totalBalance)}
          icon={FileText}
        />
      </div>

      <div className="border rounded-md mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No sales found in this date range.
                </TableCell>
              </TableRow>
            ) : (
              safeInvoices.map((invoice) => (
                <TableRow key={invoice.id} className={invoice.deleted_at ? 'text-muted-foreground' : ''}>
                  <TableCell className={invoice.deleted_at ? 'line-through' : ''}>{formatDate(invoice.invoice_date)}</TableCell>
                  <TableCell className={invoice.deleted_at ? 'line-through' : ''}>INV-{invoice.invoice_number}</TableCell>
                  <TableCell className={invoice.deleted_at ? 'line-through' : ''}>{invoice.party_name}</TableCell>
                  <TableCell>{invoice.deleted_at ? <span className="font-medium text-destructive">Voided</span> : 'Active'}</TableCell>
                  <TableCell className={`text-right ${invoice.deleted_at ? 'line-through' : ''}`}>{formatCurrency(invoice.total_amount)}</TableCell>
                  <TableCell className={`text-right ${invoice.deleted_at ? 'line-through' : ''}`}>{formatCurrency(invoice.amount_paid)}</TableCell>
                  <TableCell className={`text-right ${invoice.deleted_at ? 'line-through' : ''}`}>{formatCurrency(invoice.balance_due)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
