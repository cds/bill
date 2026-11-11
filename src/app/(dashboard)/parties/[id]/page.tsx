import { headers } from 'next/headers';
import { PartyDetailPageClient } from './party-detail-page-client';

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <PartyDetailPageClient initialTenantId={tenantId} partyId={id} />
    </div>
  );
}
