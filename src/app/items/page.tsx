import { createClient } from '@/lib/supabase/server'
import { ItemsPageClient } from '@/components/items/items-page-client'

export default async function ItemsPage() {
  const supabase = await createClient()
  
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .order('name')

  return <ItemsPageClient items={items || []} />
}
