import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/offline/expenses/route';

const TENANT_ID = 'tenant-123';
const USER_ID = 'user-123';
const EXPENSE_ID = '550e8400-e29b-41d4-a716-446655440000';
const payload = {
  id: EXPENSE_ID,
  tenant_id: TENANT_ID,
  date: '2026-11-09',
  category: 'Fuel',
  amount: 125.5,
  payment_mode: 'cash',
  notes: 'Generator',
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const mockCreateClient = vi.mocked(createClient);
let mockFrom: ReturnType<typeof vi.fn>;

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'insert', 'single', 'maybeSingle']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

function makeRequest(body: unknown = payload) {
  return new Request('http://localhost/api/offline/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
    body: JSON.stringify(body),
  });
}

describe('POST /api/offline/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi.fn();
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: (...args: unknown[]) => mockFrom(...args),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('authenticates, checks current tenant membership, and inserts the client UUID', async () => {
    const savedExpense = { ...payload, payment_status: 'paid' };
    const user = makeChain({ data: { system_role: 'user' }, error: null });
    const membership = makeChain({ data: { tenant_id: TENANT_ID }, error: null });
    const insert = makeChain({ data: savedExpense, error: null });
    mockFrom
      .mockReturnValueOnce(user)
      .mockReturnValueOnce(membership)
      .mockReturnValueOnce(insert);

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ expense: savedExpense, duplicate: false });
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'users');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'tenant_members');
    expect(membership.eq).toHaveBeenCalledWith('tenant_id', TENANT_ID);
    expect(membership.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(insert.insert).toHaveBeenCalledWith({
      ...payload,
      category: 'Fuel',
      payment_status: 'paid',
    });
  });

  it('accepts a retry with the same UUID and identical expense without inserting a duplicate', async () => {
    const savedExpense = { ...payload, payment_status: 'paid' };
    const user = makeChain({ data: { system_role: 'user' }, error: null });
    const membership = makeChain({ data: { tenant_id: TENANT_ID }, error: null });
    const duplicateInsert = makeChain({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const existing = makeChain({ data: savedExpense, error: null });
    mockFrom
      .mockReturnValueOnce(user)
      .mockReturnValueOnce(membership)
      .mockReturnValueOnce(duplicateInsert)
      .mockReturnValueOnce(existing);

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expense: savedExpense, duplicate: true });
    expect(existing.eq).toHaveBeenCalledWith('id', EXPENSE_ID);
    expect(existing.eq).toHaveBeenCalledWith('tenant_id', TENANT_ID);
  });

  it('rejects a reused UUID when the existing expense has different details', async () => {
    const user = makeChain({ data: { system_role: 'user' }, error: null });
    const membership = makeChain({ data: { tenant_id: TENANT_ID }, error: null });
    const duplicateInsert = makeChain({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const conflictingExpense = makeChain({
      data: { ...payload, amount: 999, payment_status: 'paid' },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(user)
      .mockReturnValueOnce(membership)
      .mockReturnValueOnce(duplicateInsert)
      .mockReturnValueOnce(conflictingExpense);

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('different details');
  });

  it('rejects a user who is no longer a member instead of writing to the tenant', async () => {
    const user = makeChain({ data: { system_role: 'user' }, error: null });
    const membership = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(user)
      .mockReturnValueOnce(membership);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain('not a member');
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('allows a verified super admin to sync into the active tenant without tenant membership', async () => {
    const user = makeChain({ data: { system_role: 'super_admin' }, error: null });
    const tenant = makeChain({ data: { id: TENANT_ID }, error: null });
    const insert = makeChain({ data: { ...payload, payment_status: 'paid' }, error: null });
    mockFrom
      .mockReturnValueOnce(user)
      .mockReturnValueOnce(tenant)
      .mockReturnValueOnce(insert);

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      expense: { ...payload, payment_status: 'paid' },
      duplicate: false,
    });
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'users');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'tenants');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'expenses');
  });

  it('rejects invalid expense data before database writes', async () => {
    const response = await POST(makeRequest({ ...payload, date: '2026-02-31' }));

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
