import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type InvoiceCreateBody = {
  invoice_date?: string;
  party_id?: string | null;
  party_name?: string;
  payment_type?: string;
  payment_method?: string;
  amount_paid?: number;
  notes?: string | null;
  items?: unknown[];
};

function getErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: 'Internal Server Error', status: 500 };
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'Internal Server Error';

  if (code === '42501') return { message, status: 403 };
  if (code === '55000' || code === '23505') return { message, status: 409 };
  if (['22023', '22P02', '22003', '22008', '23503', '23514'].includes(code)) {
    return { message, status: 400 };
  }
  return { message, status: 500 };
}

export async function GET(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const party_id = searchParams.get('party_id');

  let query = supabase
    .from('invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (party_id) {
    query = query.eq('party_id', party_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  let body: InvoiceCreateBody;
  try {
    const parsedBody: unknown = await request.json();
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: 'Invalid invoice request' }, { status: 400 });
    }
    body = parsedBody as InvoiceCreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { invoice_date, party_id, party_name, payment_type, payment_method, amount_paid, notes, items } = body;
  if (typeof party_name !== 'string' || !party_name.trim()) {
    return NextResponse.json({ error: 'Party name is required' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
  }

  const operationId = request.headers.get('Idempotency-Key');
  if (!operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    return NextResponse.json({ error: 'A valid Idempotency-Key is required' }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc('create_invoice', {
      p_tenant_id: tenantId,
      p_operation_id: operationId,
      p_invoice_date: invoice_date || null,
      p_party_id: party_id || null,
      p_party_name: party_name,
      p_payment_type: payment_type || 'cash',
      p_payment_method: payment_method || 'cash',
      p_amount_paid: amount_paid ?? 0,
      p_notes: notes || null,
      p_items: items,
    });

    if (error) {
      const { message, status } = getErrorDetails(error);
      if (status === 500) console.error('Invoice creation error:', error);
      return NextResponse.json({ error: message }, { status });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      console.error('Invoice creation RPC returned no invoice');
      return NextResponse.json({ error: 'Invoice creation failed' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('Invoice creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
