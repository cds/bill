import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const supabase = await createClient();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const editableFields = ['name', 'phone', 'address', 'type'];

  if (!body || !reason ||
    !editableFields.some((field) => Object.hasOwn(body, field)) ||
    (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) ||
    (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') ||
    (body.address !== undefined && body.address !== null && typeof body.address !== 'string') ||
    (body.type !== undefined && !['customer', 'supplier'].includes(String(body.type)))) {
    return NextResponse.json({ error: 'Invalid party details or missing edit reason' }, { status: 400 });
  }

  const updateData: Record<string, string | null> = { change_reason: reason };
  for (const field of editableFields) {
    if (body[field] !== undefined) {
      updateData[field] = typeof body[field] === 'string' ? body[field].trim() : null;
    }
  }

  const { data, error } = await supabase
    .from('parties')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (!data) {
    return NextResponse.json({ error: 'Party not found or already discarded' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const supabase = await createClient();

  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to discard a party' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('parties')
    .update({ deleted_at: new Date().toISOString(), deleted_reason: reason })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (!data) {
    return NextResponse.json({ error: 'Party not found or already discarded' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
