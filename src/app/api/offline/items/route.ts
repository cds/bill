import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const candidate = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const id = candidate.id;
  const submittedTenantId = candidate.tenant_id;
  const name = candidate.name;
  const unit = candidate.unit;
  const salePrice = candidate.sale_price;
  const purchasePrice = candidate.purchase_price;
  const openingStock = candidate.opening_stock;
  const lowStockThreshold = candidate.low_stock_threshold;
  const hsnCode = candidate.hsn_code;

  if (
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id) ||
    typeof submittedTenantId !== 'string' ||
    submittedTenantId !== tenantId ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 200 ||
    typeof salePrice !== 'number' ||
    !Number.isFinite(salePrice) ||
    salePrice < 0
  ) {
    return NextResponse.json({ error: 'Invalid item details' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Idempotency: Check if this item ID already exists
  const { data: existing } = await supabase
    .from('items')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ item: existing, duplicate: true }, { status: 200 });
  }

  const stockVal = typeof openingStock === 'number' && Number.isFinite(openingStock) ? openingStock : 0;

  const { data, error } = await supabase
    .from('items')
    .insert([{
      id,
      tenant_id: tenantId,
      name: name.trim(),
      unit: typeof unit === 'string' && unit.trim() ? unit.trim() : 'Pcs',
      sale_price: salePrice,
      purchase_price: typeof purchasePrice === 'number' && Number.isFinite(purchasePrice) ? purchasePrice : 0,
      opening_stock: stockVal,
      current_stock: stockVal,
      low_stock_threshold: typeof lowStockThreshold === 'number' && Number.isFinite(lowStockThreshold) ? lowStockThreshold : null,
      hsn_code: typeof hsnCode === 'string' && hsnCode.trim() ? hsnCode.trim() : null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Failed to insert offline item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add initial stock adjustment if opening stock was positive
  if (stockVal > 0) {
    await supabase.from('stock_adjustments').insert({
      item_id: id,
      tenant_id: tenantId,
      quantity: stockVal,
      type: 'opening',
      notes: 'Initial opening stock (created offline)',
    });
  }

  return NextResponse.json({ item: data, duplicate: false }, { status: 201 });
}
