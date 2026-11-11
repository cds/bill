'use client';

import { useRouter } from 'next/navigation';
import { OfflineItems } from '@/components/items/offline-items';

export function ItemsDashboard({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  return (
    <OfflineItems
      tenantId={tenantId}
      onSelectItem={(id) => router.push(`/items/${id}`)}
    />
  );
}
