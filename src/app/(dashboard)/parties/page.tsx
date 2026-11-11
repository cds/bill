import { headers } from 'next/headers';
import { PartiesPageClient } from './parties-page-client';

export const metadata = {
  title: 'Parties',
};

export default async function PartiesPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <PartiesPageClient initialTenantId={tenantId} />
    </div>
  );
}
