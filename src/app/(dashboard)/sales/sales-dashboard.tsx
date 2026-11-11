'use client';

import { useRouter } from 'next/navigation';
import { OfflineSales } from '@/components/sales/offline-sales';

export function SalesDashboard({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  return (
    <OfflineSales
      tenantId={tenantId}
      onSelectInvoice={(id) => router.push(`/sales/${id}`)}
      onNewSale={() => router.push('/sales/new')}
    />
  );
}
