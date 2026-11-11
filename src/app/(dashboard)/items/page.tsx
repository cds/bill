import { headers } from 'next/headers';
import { ItemsDashboardPage } from './items-dashboard-page';

export default async function ItemsPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <ItemsDashboardPage initialTenantId={tenantId} />
    </div>
  );
}
