import { headers } from 'next/headers';
import { NewSalePageClient } from './new-sale-page-client';

export default async function NewSalePage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return <NewSalePageClient initialTenantId={tenantId} />;
}
