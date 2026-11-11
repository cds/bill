'use client';

import { useRouter } from 'next/navigation';
import { OfflineParties } from '@/components/parties/offline-parties';

export function PartiesDashboard({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  return (
    <OfflineParties
      tenantId={tenantId}
      onSelectParty={(id) => router.push(`/parties/${id}`)}
    />
  );
}
