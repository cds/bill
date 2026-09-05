import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { PrintButton } from '@/components/shared/print-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IndianRupee } from 'lucide-react'

export default async function ExpensesReportPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const start = resolvedParams.start as string | undefined
  const end = resolvedParams.end as string | undefined

  const supabase = await createClient()

  let query = supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })

  if (start) {
    query = query.gte('date', start)
  }
  if (end) {
    query = query.lte('date', end)
  }

  const { data: expenses, error } = await query

  const safeExpenses = expenses || []

  const totalExpenses = safeExpenses.reduce((acc, exp) => acc + Number(exp.amount), 0)

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader 
          title="Expense Report" 
          action={<PrintButton />}
        />
        <div className="mt-4 mb-6">
          <DateRangeFilter />
        </div>
      </div>

      <div className="hidden print:block text-2xl font-bold mb-4">
        Expense Report {start && end ? `(${formatDate(start)} - ${formatDate(end)})` : ''}
      </div>

      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={IndianRupee}
        />
      </div>

      <div className="border rounded-md mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  No expenses found in this date range.
                </TableCell>
              </TableRow>
            ) : (
              safeExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell className="capitalize">{expense.payment_mode}</TableCell>
                  <TableCell>{expense.notes || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
