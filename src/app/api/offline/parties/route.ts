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
  const billingName = candidate.billing_name;
  const phone = candidate.phone;
  const address = candidate.address;
  const type = candidate.type;

  if (
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id) ||
    typeof submittedTenantId !== 'string' ||
    submittedTenantId !== tenantId ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 200 ||
    (type !== 'customer' && type !== 'supplier')
  ) {
    return NextResponse.json({ error: 'Invalid party details' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Idempotency: Check if this party ID already exists
  const { data: existing } = await supabase
    .from('parties')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ party: existing, duplicate: true }, { status: 200 });
  }

  const { data, error } = await supabase
    .from('parties')
    .insert([{
      id,
      tenant_id: tenantId,
      name: name.trim(),
      billing_name: typeof billingName === 'string' && billingName.trim() ? billingName.trim() : null,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      address: typeof address === 'string' && address.trim() ? address.trim() : null,
      type: type || 'customer',
      balance: 0,
    }])
    .select()
    .single();

  if (error) {
    console.error('Failed to insert offline party:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ party: data, duplicate: false }, { status: 201 });
}
