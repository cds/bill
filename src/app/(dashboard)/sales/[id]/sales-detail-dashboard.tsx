'use client';

import { useRouter } from 'next/navigation';
import { OfflineInvoiceDetail } from '@/components/sales/offline-invoice-detail';

export function SalesDetailDashboard({ tenantId, invoiceId }: { tenantId: string; invoiceId: string }) {
  const router = useRouter();

  return (
    <OfflineInvoiceDetail
      tenantId={tenantId}
      invoiceId={invoiceId}
      onBack={() => router.push('/sales')}
    />
  );
}
