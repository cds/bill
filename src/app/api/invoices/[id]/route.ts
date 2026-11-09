import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type InvoiceLineItemInput = {
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  discount_percent: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

function getErrorStatus(error: { code?: string }) {
  if (error.code === '42501') return 403;
  if (error.code === 'P0002') return 404;
  if (error.code === '22023') return 400;
  if (error.code === '55000') return 409;
  return 500;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ ...invoice, items });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    invoice_date?: unknown;
    party_id?: unknown;
    party_name?: unknown;
    payment_type?: unknown;
    payment_method?: unknown;
    amount_paid?: unknown;
    notes?: unknown;
    items?: unknown;
    reason?: unknown;
  } | null;

  if (!body || typeof body.invoice_date !== 'string' ||
    (body.party_id !== null && typeof body.party_id !== 'string') ||
    typeof body.party_name !== 'string' || !body.party_name.trim() ||
    !['cash', 'credit'].includes(String(body.payment_type)) ||
    !['cash', 'upi', 'bank'].includes(String(body.payment_method)) ||
    !Number.isFinite(Number(body.amount_paid ?? 0)) || Number(body.amount_paid ?? 0) < 0 ||
    !Array.isArray(body.items) || body.items.length === 0 ||
    typeof body.reason !== 'string' || !body.reason.trim()) {
    return NextResponse.json({ error: 'Invalid sale details or missing edit reason' }, { status: 400 });
  }

  const items = body.items as InvoiceLineItemInput[];
  if (items.some((item) =>
    !item || typeof item.item_name !== 'string' || !item.item_name.trim() ||
    typeof item.unit !== 'string' || !item.unit.trim() ||
    !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 ||
    !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0 ||
    !Number.isFinite(Number(item.tax_percent)) || Number(item.tax_percent) < 0 ||
    !Number.isFinite(Number(item.discount_percent)) || Number(item.discount_percent) < 0 ||
    Number(item.discount_percent) > 100 ||
    (item.item_id !== null && typeof item.item_id !== 'string')
  )) {
    return NextResponse.json({ error: 'One or more sale items are invalid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('edit_invoice', {
    p_invoice_id: id,
    p_invoice_date: body.invoice_date,
    p_party_id: body.party_id,
    p_party_name: body.party_name.trim(),
    p_payment_type: body.payment_type,
    p_payment_method: body.payment_method,
    p_amount_paid: Number(body.amount_paid ?? 0),
    p_notes: typeof body.notes === 'string' ? body.notes : null,
    p_items: items,
    p_reason: body.reason.trim(),
  });

  if (error) {
    console.error('Sale edit failed:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update sale') },
      { status: getErrorStatus(error) }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required to void a sale' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('void_invoice', {
    p_invoice_id: id,
    p_reason: reason,
  });

  if (error) {
    console.error('Sale void failed:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to void sale') },
      { status: getErrorStatus(error) }
    );
  }

  return NextResponse.json(data);
}
