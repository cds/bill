'use client';

import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import { Invoice } from '@/lib/supabase/types';
import { formatCurrency, formatDate } from '@/lib/utils';

interface InvoiceActionsProps {
  invoice: Invoice;
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const text = `*Invoice: #${invoice.invoice_number}*
Date: ${formatDate(invoice.invoice_date)}
Total Amount: ${formatCurrency(invoice.total_amount)}
Amount Paid: ${formatCurrency(invoice.amount_paid)}
Balance Due: ${formatCurrency(invoice.balance_due)}

Thank you for your business!
- Eatera Foods`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={handlePrint}>
        <Printer className="w-4 h-4 mr-2" />
        Print / PDF
      </Button>
      <Button className="bg-[#25D366] text-white hover:bg-[#20b858]" onClick={handleWhatsApp}>
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
    </div>
  );
}

