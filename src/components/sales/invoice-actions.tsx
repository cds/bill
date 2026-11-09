'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Edit, Printer, Share2, Trash2 } from 'lucide-react';
import { Invoice } from '@/lib/supabase/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DiscardRecordDialog } from '@/components/shared/discard-record-dialog';

interface InvoiceActionsProps {
  invoice: Invoice & { deleted_at?: string | null };
  canManageRecords: boolean;
}

export function InvoiceActions({ invoice, canManageRecords }: InvoiceActionsProps) {
  const router = useRouter();
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);

  const voidSale = async (reason: string) => {
    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to void sale');
    router.refresh();
  };

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
    <>
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        {!invoice.deleted_at && canManageRecords && (
          <>
            <Link href={`/sales/${invoice.id}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 size-4" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" onClick={() => setIsVoidDialogOpen(true)}>
              <Trash2 className="mr-2 size-4" />
              Void Sale
            </Button>
          </>
        )}
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Print / PDF
        </Button>
        <Button className="bg-[#25D366] text-white hover:bg-[#20b858]" onClick={handleWhatsApp}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>
      <DiscardRecordDialog
        open={isVoidDialogOpen}
        onOpenChange={setIsVoidDialogOpen}
        recordName={`sale #${invoice.invoice_number}`}
        actionLabel="Void"
        onConfirm={voidSale}
      />
    </>
  );
}
