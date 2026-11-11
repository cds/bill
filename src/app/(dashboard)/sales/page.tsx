import { headers } from 'next/headers';
import { SalesPageClient } from './sales-page-client';

export default async function SalesPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <SalesPageClient initialTenantId={tenantId} />
    </div>
  );
}
