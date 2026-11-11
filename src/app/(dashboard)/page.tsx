import { headers } from 'next/headers';
import { DashboardHomeClient } from './dashboard-home-client';

export default async function DashboardPage() {
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="px-4 sm:px-6 py-4 space-y-6">
      <DashboardHomeClient initialTenantId={tenantId} />
    </div>
  );
}
