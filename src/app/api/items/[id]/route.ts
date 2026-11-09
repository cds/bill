import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tenantId = request.headers.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 })
  }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tenantId = request.headers.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 })
  }
  const supabase = await createClient()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const editableFields = ['name', 'unit', 'sale_price', 'purchase_price', 'opening_stock', 'low_stock_threshold']
  if (!body || !reason ||
    !editableFields.some((field) => Object.hasOwn(body, field)) ||
    (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) ||
    (body.unit !== undefined && (typeof body.unit !== 'string' || !body.unit.trim())) ||
    ['sale_price', 'purchase_price', 'opening_stock', 'low_stock_threshold']
      .some((field) => body[field] !== undefined &&
        (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0))) {
    return NextResponse.json({ error: 'Invalid item details or missing edit reason' }, { status: 400 })
  }

  // Fetch current item to check stock difference
  const { data: currentItem, error: fetchError } = await supabase
    .from('items')
    .select('opening_stock, current_stock')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const updateData: Record<string, string | number> = { change_reason: reason }
  if (typeof body.name === 'string') updateData.name = body.name.trim()
  if (typeof body.unit === 'string') updateData.unit = body.unit.trim()
  for (const field of ['sale_price', 'purchase_price', 'opening_stock', 'low_stock_threshold']) {
    if (body[field] !== undefined) updateData[field] = Number(body[field])
  }

  // If opening stock changed, adjust current stock
  if (body.opening_stock !== undefined && Number(body.opening_stock) !== currentItem.opening_stock) {
    const diff = Number(body.opening_stock) - currentItem.opening_stock
    updateData.current_stock = currentItem.current_stock + diff
  }

  const { data, error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tenantId = request.headers.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 })
  }
  const supabase = await createClient()
  const body = await request.json().catch(() => null) as { reason?: unknown } | null
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to discard an item' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('items')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const status = error.code === '42501' ? 403 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  if (!data) {
    return NextResponse.json({ error: 'Item not found or already discarded' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
