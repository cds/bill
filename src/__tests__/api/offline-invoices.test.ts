import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const createInvoice = vi.fn();

vi.mock('@/app/api/invoices/route', () => ({
  POST: (...args: unknown[]) => createInvoice(...args),
}));

function makeRequest(
  body: unknown,
  tenantId: string | null = 'tenant-123',
  systemRole: string | null = null,
) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (systemRole) headers.set('x-system-role', systemRole);
  return new NextRequest('http://localhost/api/offline/invoices', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const offlineInvoice = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: 'tenant-123',
  invoice_date: '2026-11-09',
  party_id: 'party-123',
  party_name: 'Acme',
  payment_type: 'cash',
  payment_method: 'cash',
  amount_paid: 100,
  notes: null,
  items: [{ item_id: 'item-123', item_name: 'Widget', quantity: 1, rate: 100 }],
};

describe('POST /api/offline/invoices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createInvoice.mockResolvedValue(Response.json({
      id: 'server-invoice-123',
      invoice_number: 84,
    }, { status: 201 }));
  });

  it('requires tenant context', async () => {
    const { POST } = await import('@/app/api/offline/invoices/route');
    const response = await POST(makeRequest(offlineInvoice, null));

    expect(response.status).toBe(403);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('rejects invalid local IDs and a mismatched tenant', async () => {
    const { POST } = await import('@/app/api/offline/invoices/route');
    const invalidId = await POST(makeRequest({ ...offlineInvoice, id: 'not-a-uuid' }));
    const tenantMismatch = await POST(makeRequest({
      ...offlineInvoice,
      tenant_id: 'another-tenant',
    }));

    expect(invalidId.status).toBe(400);
    expect(tenantMismatch.status).toBe(403);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('uses the stable local UUID as the atomic operation idempotency key', async () => {
    const { POST } = await import('@/app/api/offline/invoices/route');
    const response = await POST(makeRequest(offlineInvoice));
    const forwardedRequest = createInvoice.mock.calls[0][0] as Request;

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ invoice_number: 84 });
    expect(forwardedRequest.headers.get('Idempotency-Key')).toBe(offlineInvoice.id);
    expect(forwardedRequest.headers.get('x-tenant-id')).toBe(offlineInvoice.tenant_id);
    expect(await forwardedRequest.json()).toMatchObject({
      party_name: offlineInvoice.party_name,
      items: offlineInvoice.items,
    });
  });

  it('lets a super admin sync an offline invoice to its selected tenant', async () => {
    const { POST } = await import('@/app/api/offline/invoices/route');
    const selectedTenantInvoice = { ...offlineInvoice, tenant_id: 'selected-tenant' };
    const response = await POST(makeRequest(
      selectedTenantInvoice,
      'active-tenant',
      'super_admin',
    ));
    const forwardedRequest = createInvoice.mock.calls[0][0] as Request;

    expect(response.status).toBe(201);
    expect(forwardedRequest.headers.get('x-tenant-id')).toBe('selected-tenant');
  });

  it('preserves server rejection status and details', async () => {
    createInvoice.mockResolvedValue(Response.json(
      { error: 'Insufficient server stock; cached stock is only an estimate.' },
      { status: 400 },
    ));
    const { POST } = await import('@/app/api/offline/invoices/route');
    const response = await POST(makeRequest(offlineInvoice));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Insufficient server stock/);
  });
});
