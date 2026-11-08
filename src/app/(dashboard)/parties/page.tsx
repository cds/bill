import { createClient } from '@/lib/supabase/server';
import { getActiveTenantId } from '@/lib/supabase/tenant-context';
import { PartiesPageClient } from './parties-page-client';

export const metadata = {
  title: 'Parties',
};

export default async function PartiesPage() {
  const supabase = await createClient();
  const tenantId = await getActiveTenantId();
  const { data: parties, error } = await supabase
    .from('parties')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) {
    console.error('Error fetching parties:', error);
  }

  return (
    <div className="container mx-auto py-8">
      <PartiesPageClient parties={parties || []} />
    </div>
  );
}
