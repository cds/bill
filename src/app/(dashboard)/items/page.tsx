import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/supabase/tenant-context'
import { ItemsPageClient } from '@/components/items/items-page-client'

export default async function ItemsPage() {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  return <ItemsPageClient items={items || []} />
}
