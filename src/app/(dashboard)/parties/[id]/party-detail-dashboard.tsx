'use client';

import { useRouter } from 'next/navigation';
import { OfflinePartyDetail } from '@/components/parties/offline-party-detail';

export function PartyDetailDashboard({ tenantId, partyId }: { tenantId: string; partyId: string }) {
  const router = useRouter();

  return (
    <OfflinePartyDetail
      tenantId={tenantId}
      partyId={partyId}
      onBack={() => router.push('/parties')}
      onSelectInvoice={(id) => router.push(`/sales/${id}`)}
    />
  );
}
