import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest as BaseNextRequest } from 'next/server'
import { DELETE, GET, PATCH } from '@/app/api/invoices/[id]/route'

const TENANT_ID = 'tenant-uuid-111'
const INVOICE_ID = 'invoice-uuid-444'

class NextRequest extends BaseNextRequest {
  constructor(input: string | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers)
    if (!headers.has('x-tenant-id')) headers.set('x-tenant-id', TENANT_ID)
    super(input, { ...init, headers })
  }
}

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
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
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'is',
    'order', 'limit', 'ilike', 'single', 'maybeSingle', 'filter',
    'match', 'in', 'or',
  ]
  for (const method of methods) chain[method] = vi.fn().mockReturnThis()
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolved).then(resolve)
  return chain
}

describe('/api/invoices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null })
  })

  it('GET returns invoice with all line items, including archived history', async () => {
    const invoice = { id: INVOICE_ID, invoice_number: 101, deleted_at: null }
    const items = [{ id: 'line-1', item_name: 'Crackers', deleted_at: null }]
    mockFrom = vi.fn((table: string) => makeChain({
      data: table === 'invoices' ? invoice : items,
      error: null,
    }))

    const response = await GET(
      new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toEqual(items)
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'invoice_items')
  })

  it('GET returns 404 when invoice is not available in tenant scope', async () => {
    mockFrom = vi.fn(() => makeChain({ data: null, error: { message: 'Not found' } }))
    const response = await GET(
      new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )
    expect(response.status).toBe(404)
  })

  it('DELETE requires a reason before voiding', async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )
    expect(response.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('DELETE calls the atomic void operation with invoice id and reason', async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Duplicate sale' }),
      }),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )

    expect(response.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('void_invoice', {
      p_invoice_id: INVOICE_ID,
      p_reason: 'Duplicate sale',
    })
  })

  it('DELETE maps database authorization errors to 403', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Only tenant administrators can void sales.' },
    })
    const response = await DELETE(
      new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Duplicate sale' }),
      }),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )
    expect(response.status).toBe(403)
  })

  it('PATCH validates a change reason and sends the edit to the atomic operation', async () => {
    const body = {
      invoice_date: '2026-11-09',
      party_id: null,
      party_name: 'Walk-in Customer',
      payment_type: 'cash',
      payment_method: 'cash',
      amount_paid: 150,
      notes: null,
      reason: 'Corrected quantity',
      items: [{
        item_id: null,
        item_name: 'Snack Box',
        quantity: 3,
        unit: 'Box',
        rate: 50,
        tax_percent: 0,
        discount_percent: 0,
      }],
    }

    const response = await PATCH(
      new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )

    expect(response.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('edit_invoice', expect.objectContaining({
      p_invoice_id: INVOICE_ID,
      p_reason: 'Corrected quantity',
      p_items: body.items,
    }))
  })
})
