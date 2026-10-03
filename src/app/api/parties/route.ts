import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const search = searchParams.get('search');

  let query = supabase.from('parties').select('*');

  if (type) {
    query = query.eq('type', type);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query.order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const { name, phone, address, type } = body;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (type !== undefined && type !== 'customer' && type !== 'supplier') {
    return NextResponse.json({ error: 'Type must be customer or supplier' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('parties')
    .insert([{
      name: name.trim(),
      phone: phone || null,
      address: address || null,
      type: type || 'customer',
      tenant_id: tenantId,
    }])
    .select()
    .single();

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data, { status: 201 });
}
