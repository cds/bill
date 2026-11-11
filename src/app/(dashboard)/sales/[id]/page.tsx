import { headers } from 'next/headers';
import { SaleDetailPageClient } from './sale-detail-page-client';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get('x-tenant-id');

  return (
    <div className="container mx-auto py-8">
      <SaleDetailPageClient initialTenantId={tenantId} invoiceId={id} />
    </div>
  );
}
