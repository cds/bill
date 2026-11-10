import { NextResponse } from 'next/server';
import { POST as createInvoice } from '@/app/api/invoices/route';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid invoice request' }, { status: 400 });
  }
  const invoice = body as Record<string, unknown>;
  if (typeof invoice.id !== 'string' || !UUID_PATTERN.test(invoice.id)) {
    return NextResponse.json({ error: 'A valid local invoice ID is required' }, { status: 400 });
  }
  const activeTenantId = request.headers.get('x-tenant-id');
  const isSuperAdmin = request.headers.get('x-system-role') === 'super_admin';
  if (!activeTenantId && !isSuperAdmin) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  if (
    typeof invoice.tenant_id !== 'string' ||
    (!isSuperAdmin && invoice.tenant_id !== activeTenantId)
  ) {
    return NextResponse.json({ error: 'Invoice tenant does not match the current tenant' }, { status: 403 });
  }

  const headers = new Headers(request.headers);
  headers.set('x-tenant-id', invoice.tenant_id);
  headers.set('Idempotency-Key', invoice.id);
  const atomicRequest = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(invoice),
  });

  return createInvoice(atomicRequest);
}
