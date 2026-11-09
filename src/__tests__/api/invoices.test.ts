import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest as BaseNextRequest } from 'next/server'

const TENANT_ID = 'tenant-uuid-111'
const PARTY_ID = 'party-uuid-222'
const ITEM_ID = 'item-uuid-333'
const INVOICE_ID = 'invoice-uuid-444'
const OPERATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

class NextRequest extends BaseNextRequest {
  constructor(input: string | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers)
    if (!headers.has('x-tenant-id')) headers.set('x-tenant-id', TENANT_ID)
    super(input, { ...init, headers })
  }
}

function makePostRequest(
  body: object,
  headers: Record<string, string> = {
    'x-tenant-id': TENANT_ID,
    'Idempotency-Key': OPERATION_ID,
  },
) {
  return new BaseNextRequest('http://localhost/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const validBody = {
  invoice_date: '2026-03-02',
  party_id: PARTY_ID,
  party_name: 'Acme Corp',
  payment_type: 'cash',
  payment_method: 'cash',
  amount_paid: 0,
  items: [{
    item_id: ITEM_ID,
    item_name: 'Widget',
    quantity: 2,
    rate: 50,
    unit: 'pcs',
    tax_percent: 0,
    discount_percent: 0,
  }],
}

const mockInvoice = {
  id: INVOICE_ID,
  invoice_number: 1,
  party_name: 'Acme Corp',
  total_amount: 100,
  balance_due: 0,
  payment_type: 'cash',
  tenant_id: TENANT_ID,
}

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

let mockFrom: ReturnType<typeof vi.fn>
let mockRpc: ReturnType<typeof vi.fn>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}))

function makeChain(resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const method of [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit',
    'ilike', 'single', 'maybeSingle', 'filter', 'match', 'in', 'or', 'is',
  ]) {
    chain[method] = vi.fn().mockReturnThis()
  }
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolved).then(resolve)
  return chain
}

beforeEach(() => {
  mockFrom = vi.fn().mockReturnValue(
    makeChain({ data: [{ id: INVOICE_ID, party_name: 'Acme Corp', tenant_id: TENANT_ID }], error: null }),
  )
  mockRpc = vi.fn().mockResolvedValue({ data: mockInvoice, error: null })
})

describe('GET /api/invoices', () => {
  it('lists invoices for the selected tenant', async () => {
    const { GET } = await import('@/app/api/invoices/route')
    const response = await GET(new NextRequest('http://localhost/api/invoices'))

    expect(response.status).toBe(200)
    expect((await response.json())[0].party_name).toBe('Acme Corp')
  })

  it('filters invoices by party_id', async () => {
    const { GET } = await import('@/app/api/invoices/route')
    const response = await GET(new NextRequest(
      `http://localhost/api/invoices?party_id=${PARTY_ID}`,
    ))

    const chain = mockFrom.mock.results[0].value
    expect(chain.eq).toHaveBeenCalledWith('party_id', PARTY_ID)
    expect(response.status).toBe(200)
  })

  it('returns 403 when tenant context is missing', async () => {
    const { GET } = await import('@/app/api/invoices/route')
    const response = await GET(new BaseNextRequest('http://localhost/api/invoices'))

    expect(response.status).toBe(403)
  })

  it('returns database errors', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }))
    const { GET } = await import('@/app/api/invoices/route')
    const response = await GET(new NextRequest('http://localhost/api/invoices'))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('DB error')
  })
})

describe('POST /api/invoices', () => {
  it('requires tenant context', async () => {
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody, {
      'Idempotency-Key': OPERATION_ID,
    }))

    expect(response.status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('requires party name and invoice items', async () => {
    const { POST } = await import('@/app/api/invoices/route')
    const missingParty = await POST(makePostRequest({ ...validBody, party_name: ' ' }))
    const missingItems = await POST(makePostRequest({ ...validBody, items: [] }))

    expect(missingParty.status).toBe(400)
    expect((await missingParty.json()).error).toMatch(/party name/i)
    expect(missingItems.status).toBe(400)
    expect((await missingItems.json()).error).toMatch(/item/i)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('requires a valid idempotency key', async () => {
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody, { 'x-tenant-id': TENANT_ID }))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/Idempotency-Key/)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('creates through one tenant-scoped RPC and returns the invoice', async () => {
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ id: INVOICE_ID })
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('create_invoice', {
      p_tenant_id: TENANT_ID,
      p_operation_id: OPERATION_ID,
      p_invoice_date: validBody.invoice_date,
      p_party_id: PARTY_ID,
      p_party_name: 'Acme Corp',
      p_payment_type: 'cash',
      p_payment_method: 'cash',
      p_amount_paid: 0,
      p_notes: null,
      p_items: validBody.items,
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('defaults omitted payment fields before calling the RPC', async () => {
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest({
      party_name: validBody.party_name,
      items: validBody.items,
    }))

    expect(response.status).toBe(201)
    expect(mockRpc).toHaveBeenCalledWith('create_invoice', expect.objectContaining({
      p_payment_type: 'cash',
      p_payment_method: 'cash',
      p_amount_paid: 0,
    }))
  })

  it('uses the same operation ID and payload when a request is retried', async () => {
    const { POST } = await import('@/app/api/invoices/route')
    const first = await POST(makePostRequest(validBody))
    const second = await POST(makePostRequest(validBody))

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect((await first.json()).id).toBe((await second.json()).id)
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc.mock.calls[0]).toEqual(mockRpc.mock.calls[1])
  })

  it('maps tenant membership rejection to 403', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'User is not a member of the selected tenant.' },
    })
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(403)
    expect((await response.json()).error).toMatch(/member/i)
  })

  it('returns a validation error when the RPC rejects a cross-tenant record', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'One or more items were not found in the selected tenant.' },
    })
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/selected tenant/i)
  })

  it('returns the atomic operation error without issuing partial table writes', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'A sale item is unavailable or discarded.' },
    })
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(400)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns 409 when an operation ID is reused with different data', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '55000', message: 'Invoice operation ID was already used with different data.' },
    })
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/different data/i)
  })

  it('returns a server error when the RPC response is empty', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { POST } = await import('@/app/api/invoices/route')
    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(500)
  })
})
