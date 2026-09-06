import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Package, Users, Receipt } from 'lucide-react';

const reports = [
  {
    title: 'Sale Report',
    description: 'View all sales invoices within a specific date range.',
    icon: BarChart3,
    href: '/reports/sales',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    title: 'Stock Detail Report',
    description: 'Track opening, in, out, and closing stock for items.',
    icon: Package,
    href: '/reports/stock',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    title: 'Party Statement',
    description: 'Ledger showing opening balance, invoices, payments, and closing balance.',
    icon: Users,
    href: '/reports/parties',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    title: 'Expense Transaction Report',
    description: 'View categorized expenses over time.',
    icon: Receipt,
    href: '/reports/expenses',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
];

export default function ReportsDirectoryPage() {
  return (
    <div className="px-4 sm:px-6 py-4 space-y-6">
      <PageHeader title="Reports" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className={`p-3 rounded-lg ${report.bgColor}`}>
                    <Icon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {report.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

