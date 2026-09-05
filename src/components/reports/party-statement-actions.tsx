'use client';

import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PartyStatementActionsProps {
  partyName: string;
  start: string;
  end: string;
  openingBalance: number;
  closingBalance: number;
  transactionsCount: number;
}

export function PartyStatementActions({ 
  partyName, 
  start, 
  end, 
  openingBalance, 
  closingBalance,
  transactionsCount 
}: PartyStatementActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const text = `*Statement for ${partyName}*
Period: ${formatDate(start)} to ${formatDate(end)}

Opening Balance: ${formatCurrency(openingBalance)}
Closing Balance: ${formatCurrency(closingBalance)}
Transactions: ${transactionsCount}

Thank you for your business!
- Eatera Foods`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={handlePrint}>
        <Printer className="w-4 h-4 mr-2" />
        Print
      </Button>
      <Button className="bg-[#25D366] text-white hover:bg-[#20b858]" onClick={handleWhatsApp}>
        <Share2 className="w-4 h-4 mr-2" />
        WhatsApp
      </Button>
    </div>
  );
}

