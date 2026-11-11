import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { InvoiceForm } from '@/components/sales/invoice-form';

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const canManageRecords = requestHeaders.get('x-tenant-role') === 'tenant_admin' ||
    requestHeaders.get('x-system-role') === 'super_admin';
  if (!canManageRecords) redirect('/sales');

  const supabase = await createClient();
  const tenantId = await getActiveTenantId();
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (invoiceError || !invoice) notFound();

  const { data: invoiceItems, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to load sale items: ${itemsError.message}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Editing synced sales requires an online connection and cannot be queued in Local-only mode. Switch sync to Online on the dashboard before saving changes.
      </p>
      <InvoiceForm invoice={invoice} invoiceItems={invoiceItems ?? []} />
    </div>
  );
}
