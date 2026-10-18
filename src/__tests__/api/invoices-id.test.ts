/**
 * Tests: GET /api/invoices/[id]  and  DELETE /api/invoices/[id]
 *
 * Covers test IDs: I-17 → I-25
 *
 * Scenarios:
 *  - I-17: Get existing invoice belonging to tenant -> 200 with merged items
 *  - I-18: Cross-tenant / RLS block -> 404
 *  - I-19: Non-existent invoice UUID -> 404
 *  - I-20: Items fetch error -> 400
 *  - I-21: Delete credit invoice with tracked items -> reverts stock, deletes sale adjustments, reverts party balance
 *  - I-22: Delete cash invoice without tracked items -> clean delete
 *  - I-23: Delete invoice when fetch fails (cross-tenant / non-existent) -> 500 error
 *  - I-24: Delete invoice when delete query fails -> 500 error
 *  - I-25: Worker caller invokes DELETE -> verifies handler executes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, DELETE } from '@/app/api/invoices/[id]/route'

const TENANT_ID = 'tenant-uuid-111'
const PARTY_ID = 'party-uuid-222'
const ITEM_ID = 'item-uuid-333'
const INVOICE_ID = 'invoice-uuid-444'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

let mockFrom: ReturnType<typeof vi.fn>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}))

function makeChain(resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq',
                   'order', 'limit', 'ilike', 'single', 'maybeSingle', 'filter', 'match', 'in', 'or']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis()
  }
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve)
  return chain
}

describe('GET /api/invoices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // I-17
  it('I-17: Returns 200 with merged invoice and items data for existing invoice', async () => {
    const mockInvoice = {
      id: INVOICE_ID,
      tenant_id: TENANT_ID,
      invoice_number: 'INV-101',
      total_amount: 150,
    }
    const mockItems = [
      { id: 'item-row-1', invoice_id: INVOICE_ID, item_name: 'Widget A', quantity: 2, rate: 75 }
    ]

    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') return makeChain({ data: mockInvoice, error: null })
      if (table === 'invoice_items') return makeChain({ data: mockItems, error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'tenant_admin' },
    })

    const res = await GET(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(INVOICE_ID)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].item_name).toBe('Widget A')
  })

  // I-18 / I-19
  it('I-18 & I-19: Returns 404 when invoice is not found or blocked by RLS', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: null, error: { message: 'Row not found' } })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Row not found')
  })

  // I-20
  it('I-20: Returns 400 when fetching invoice items fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: { id: INVOICE_ID, invoice_number: 'INV-101' }, error: null })
      }
      if (table === 'invoice_items') {
        return makeChain({ data: null, error: { message: 'Failed to fetch items' } })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Failed to fetch items')
  })
})

describe('DELETE /api/invoices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // I-21
  it('I-21: Reverts stock, deletes stock adjustments, reverts party balance, and deletes invoice', async () => {
    const mockInvoice = {
      id: INVOICE_ID,
      tenant_id: TENANT_ID,
      party_id: PARTY_ID,
      payment_type: 'credit',
      balance_due: 100,
    }
    const mockItems = [
      { id: 'row-1', item_id: ITEM_ID, quantity: 5 }
    ]

    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        // Can be queried via select or delete
        return makeChain({ data: mockInvoice, error: null })
      }
      if (table === 'invoice_items') {
        return makeChain({ data: mockItems, error: null })
      }
      if (table === 'items') {
        return makeChain({ data: { current_stock: 20 }, error: null })
      }
      if (table === 'parties') {
        return makeChain({ data: { balance: 250 }, error: null })
      }
      if (table === 'stock_adjustments') {
        return makeChain({ data: null, error: null })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'tenant_admin' },
    })

    const res = await DELETE(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })

    const tablesCalled = mockFrom.mock.calls.map(([t]) => t)
    expect(tablesCalled).toContain('invoices')
    expect(tablesCalled).toContain('invoice_items')
    expect(tablesCalled).toContain('items')
    expect(tablesCalled).toContain('stock_adjustments')
    expect(tablesCalled).toContain('parties')
  })

  // I-22
  it('I-22: Deletes cash invoice without tracked items cleanly (no stock or party update)', async () => {
    const mockInvoice = {
      id: INVOICE_ID,
      tenant_id: TENANT_ID,
      party_id: PARTY_ID,
      payment_type: 'cash',
      balance_due: 0,
    }
    const mockItems = [
      { id: 'row-1', item_id: null, quantity: 1 } // Untracked item
    ]

    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') return makeChain({ data: mockInvoice, error: null })
      if (table === 'invoice_items') return makeChain({ data: mockItems, error: null })
      if (table === 'stock_adjustments') return makeChain({ data: null, error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    const res = await DELETE(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })

    const tablesCalled = mockFrom.mock.calls.map(([t]) => t)
    expect(tablesCalled).not.toContain('items')
    expect(tablesCalled).not.toContain('parties')
  })

  // I-23 & I-24
  it('I-23 & I-24: Returns 500 when invoice lookup fails or invoice delete fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: null, error: { message: 'Database query error' } })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
      method: 'DELETE',
    })

    const res = await DELETE(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Database query error')
  })

  // I-25
  it('I-25: Worker role invocation executes DELETE handler', async () => {
    const mockInvoice = {
      id: INVOICE_ID,
      tenant_id: TENANT_ID,
      payment_type: 'cash',
      balance_due: 0,
    }

    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') return makeChain({ data: mockInvoice, error: null })
      if (table === 'invoice_items') return makeChain({ data: [], error: null })
      if (table === 'stock_adjustments') return makeChain({ data: null, error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/invoices/${INVOICE_ID}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'worker' },
    })

    const res = await DELETE(req, { params: Promise.resolve({ id: INVOICE_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

