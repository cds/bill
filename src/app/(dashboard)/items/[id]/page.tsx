import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/supabase/tenant-context'
import { ItemDetailClient } from '@/components/items/item-detail-client'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  
  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!item) {
    notFound()
  }

  const { data: adjustments } = await supabase
    .from('stock_adjustments')
    .select('*')
    .eq('item_id', id)
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  return <ItemDetailClient item={item} stockAdjustments={adjustments || []} />
}
