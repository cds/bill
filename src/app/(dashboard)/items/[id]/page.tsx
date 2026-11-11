import { headers } from 'next/headers';
import { ItemDetailPageClient } from './item-detail-page-client';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <ItemDetailPageClient initialTenantId={tenantId} itemId={id} />
    </div>
  );
}
