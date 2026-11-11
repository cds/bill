'use client';

import { useRouter } from 'next/navigation';
import { OfflineItemDetail } from '@/components/items/offline-item-detail';

export function ItemDetailDashboard({ tenantId, itemId }: { tenantId: string; itemId: string }) {
  const router = useRouter();

  return (
    <OfflineItemDetail
      tenantId={tenantId}
      itemId={itemId}
      onBack={() => router.push('/items')}
    />
  );
}
