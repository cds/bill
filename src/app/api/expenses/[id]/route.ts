import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

function getErrorStatus(error: { code?: string }) {
  if (error.code === '42501') return 403;
  if (error.code === 'PGRST116') return 404;
  return 500;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.date !== 'string' || typeof body.category !== 'string' ||
    !body.category.trim() || !Number.isFinite(Number(body.amount)) ||
    Number(body.amount) < 0 ||
    !['cash', 'bank', 'upi'].includes(String(body.payment_mode)) ||
    typeof body.reason !== 'string' || !body.reason.trim()) {
    return NextResponse.json({ error: 'Invalid expense details or missing edit reason' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .update({
      date: body.date,
      category: body.category.trim(),
      amount: Number(body.amount),
      payment_mode: body.payment_mode,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      change_reason: body.reason.trim(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) });
  }
  if (!data) {
    return NextResponse.json({ error: 'Expense not found or already discarded' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to discard an expense' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error) });
  }
  if (!data) {
    return NextResponse.json({ error: 'Expense not found or already discarded' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
