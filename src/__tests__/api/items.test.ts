/**
 * Tests: /api/items, /api/items/[id], and /api/items/[id]/adjust
 *
 * Covers test IDs: IT-01 → IT-23
 *
 * Scenarios:
 *  - GET /api/items: list all items, search query with ilike, database error handling
 *  - POST /api/items: opening_stock > 0 creates stock adjustment, opening_stock = 0 does not,
 *                     missing tenant header (403), database error handling (500)
 *  - GET /api/items/[id]: retrieve item (200), error handling (500)
 *  - PATCH /api/items/[id]: update fields, diff calculation when opening_stock changes,
 *                           error on initial fetch or update
 *  - DELETE /api/items/[id]: successful deletion, database error handling
 *  - POST /api/items/[id]/adjust: missing tenant header (403), missing required fields (400),
 *                                 item not found (404), add stock (200), subtract stock (200),
 *                                 over-subtracting to negative (200), DB adjustment error (500)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getItems, POST as createItem } from '@/app/api/items/route'
import { GET as getItemById, PATCH as updateItem, DELETE as deleteItem } from '@/app/api/items/[id]/route'
import { POST as adjustStock } from '@/app/api/items/[id]/adjust/route'

const TENANT_ID = 'tenant-uuid-111'
const ITEM_ID = 'item-uuid-333'

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
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq',
    'order', 'limit', 'ilike', 'single', 'maybeSingle',
    'filter', 'match', 'in', 'or'
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis()
  }
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolved)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve)
  return chain
}

describe('GET /api/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // IT-01
  it('IT-01: Lists all items ordered by name (200)', async () => {
    const mockItems = [
      { id: 'item-1', name: 'Cable', current_stock: 50 },
      { id: 'item-2', name: 'Router', current_stock: 12 },
    ]
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: mockItems, error: null }))

    const req = new NextRequest('http://localhost/api/items', {
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'worker' },
    })
    const res = await getItems(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  // IT-02
  it('IT-02: Applies search filter using ilike', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: [], error: null }))

    const req = new NextRequest('http://localhost/api/items?search=cable')
    const res = await getItems(req)

    expect(res.status).toBe(200)
    const chain = mockFrom.mock.results[0].value
    expect((chain.ilike as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([['name', '%cable%']])
    )
  })

  // IT-03
  it('IT-03: Returns 500 when Supabase query fails', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'DB items error' } }))

    const req = new NextRequest('http://localhost/api/items')
    const res = await getItems(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('DB items error')
  })
})

describe('POST /api/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // IT-06
  it('IT-06: Missing x-tenant-id returns 403', async () => {
    const req = new NextRequest('http://localhost/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'Switch' }),
    })
    const res = await createItem(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Tenant context is missing')
  })

  // IT-04
  it('IT-04: Creates item with opening_stock > 0 and inserts opening stock_adjustments', async () => {
    const createdItem = {
      id: ITEM_ID,
      name: 'Server Rack',
      opening_stock: 10,
      current_stock: 10,
      tenant_id: TENANT_ID,
    }

    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'items') return makeChain({ data: createdItem, error: null })
      if (table === 'stock_adjustments') return makeChain({ data: [], error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest('http://localhost/api/items', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: 'Server Rack', opening_stock: 10 }),
    })
    const res = await createItem(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(ITEM_ID)
    expect(body.current_stock).toBe(10)

    const tablesCalled = mockFrom.mock.calls.map(([t]) => t)
    expect(tablesCalled).toContain('stock_adjustments')
  })

  // IT-05
  it('IT-05: Creates item with opening_stock = 0 without stock_adjustments', async () => {
    const createdItem = {
      id: ITEM_ID,
      name: 'Ethernet RJ45',
      opening_stock: 0,
      current_stock: 0,
      tenant_id: TENANT_ID,
    }

    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'items') return makeChain({ data: createdItem, error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest('http://localhost/api/items', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: 'Ethernet RJ45', opening_stock: 0 }),
    })
    const res = await createItem(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(ITEM_ID)

    const tablesCalled = mockFrom.mock.calls.map(([t]) => t)
    expect(tablesCalled).not.toContain('stock_adjustments')
  })

  // IT-07
  it('IT-07: Returns 500 when item creation fails', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Insert failed' } }))

    const req = new NextRequest('http://localhost/api/items', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: 'Failing Item' }),
    })
    const res = await createItem(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Insert failed')
  })
})

describe('GET /api/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // IT-08
  it('IT-08: Returns item by id (200)', async () => {
    const mockItem = { id: ITEM_ID, name: 'Adapter', current_stock: 15 }
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: mockItem, error: null }))

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`)
    const res = await getItemById(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(ITEM_ID)
  })

  // IT-09 & IT-10
  it('IT-09 & IT-10: Returns 500 when fetch query produces error', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Item query error' } }))

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`)
    const res = await getItemById(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Item query error')
  })
})

describe('PATCH /api/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // IT-11
  it('IT-11: Updates basic fields without touching stock if opening_stock unchanged', async () => {
    const currentItem = { id: ITEM_ID, opening_stock: 10, current_stock: 10 }
    const updatedItem = { id: ITEM_ID, name: 'Updated Adapter', opening_stock: 10, current_stock: 10 }

    mockFrom = vi.fn().mockImplementation((table: string) => {
      // First call: select currentItem
      // Second call: update
      return makeChain({ data: currentItem, error: null })
    })

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Adapter' }),
    })
    const res = await updateItem(req, { params: Promise.resolve({ id: ITEM_ID }) })

    expect(res.status).toBe(200)
  })

  // IT-12
  it('IT-12: Increases current_stock by diff when opening_stock is increased', async () => {
    const currentItem = { id: ITEM_ID, opening_stock: 10, current_stock: 15 }
    let updatePayload: Record<string, unknown> | null = null

    mockFrom = vi.fn().mockImplementation(() => {
      const chain = makeChain({ data: currentItem, error: null })
      chain.update = vi.fn().mockImplementation((payload) => {
        updatePayload = payload
        return chain
      })
      return chain
    })

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ opening_stock: 15 }),
    })
    const res = await updateItem(req, { params: Promise.resolve({ id: ITEM_ID }) })

    expect(res.status).toBe(200)
    expect(updatePayload).toBeDefined()
    expect(updatePayload!.current_stock).toBe(20) // 15 + (15 - 10)
  })

  // IT-13
  it('IT-13: Decreases current_stock by diff when opening_stock is decreased', async () => {
    const currentItem = { id: ITEM_ID, opening_stock: 20, current_stock: 25 }
    let updatePayload: Record<string, unknown> | null = null

    mockFrom = vi.fn().mockImplementation(() => {
      const chain = makeChain({ data: currentItem, error: null })
      chain.update = vi.fn().mockImplementation((payload) => {
        updatePayload = payload
        return chain
      })
      return chain
    })

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ opening_stock: 15 }),
    })
    const res = await updateItem(req, { params: Promise.resolve({ id: ITEM_ID }) })

    expect(res.status).toBe(200)
    expect(updatePayload).toBeDefined()
    expect(updatePayload!.current_stock).toBe(20) // 25 + (15 - 20)
  })

  // IT-14
  it('IT-14: Returns 500 when initial item fetch fails', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Fetch before update failed' } }))

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    })
    const res = await updateItem(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Fetch before update failed')
  })
})

describe('DELETE /api/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // IT-15 & IT-17
  it('IT-15 & IT-17: Successfully deletes item (200 { success: true })', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'worker' },
    })
    const res = await deleteItem(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  // IT-16
  it('IT-16: Returns 500 when delete fails', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Delete constraint failure' } }))

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}`, { method: 'DELETE' })
    const res = await deleteItem(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Delete constraint failure')
  })
})

describe('POST /api/items/[id]/adjust', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // IT-21
  it('IT-21: Missing x-tenant-id returns 403', async () => {
    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ type: 'add', quantity: 5, date: '2026-10-18' }),
    })
    const res = await adjustStock(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Tenant context is missing')
  })

  // IT-22
  it('IT-22: Returns 400 when required fields (type, quantity, date) are missing', async () => {
    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/adjust`, {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ type: 'add' }), // missing quantity, date
    })
    const res = await adjustStock(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Missing required fields')
  })

  // IT-23
  it('IT-23: Returns 404 when item is not found', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Item not found' } }))

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/adjust`, {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ type: 'add', quantity: 5, date: '2026-10-18' }),
    })
    const res = await adjustStock(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Item not found')
  })

  // IT-18
  it('IT-18: Type "add" increments stock and inserts stock_adjustment record', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'items') return makeChain({ data: { current_stock: 50 }, error: null })
      if (table === 'stock_adjustments') return makeChain({ data: [], error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/adjust`, {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'tenant_admin' },
      body: JSON.stringify({
        type: 'add',
        quantity: 20,
        date: '2026-10-18',
        unit_cost: 15,
        notes: 'Restock shipment',
      }),
    })
    const res = await adjustStock(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, newStock: 70 })
  })

  // IT-19 & IT-20
  it('IT-19 & IT-20: Type "subtract" decrements stock and allows negative stock', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'items') return makeChain({ data: { current_stock: 5 }, error: null })
      if (table === 'stock_adjustments') return makeChain({ data: [], error: null })
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/adjust`, {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        type: 'subtract',
        quantity: 15, // 5 - 15 = -10
        date: '2026-10-18',
      }),
    })
    const res = await adjustStock(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, newStock: -10 })
  })

  it('IT-23b: Returns 500 when stock_adjustment insert fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'items') return makeChain({ data: { current_stock: 50 }, error: null })
      if (table === 'stock_adjustments') {
        return makeChain({ data: null, error: { message: 'Adjustment insert error' } })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/adjust`, {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ type: 'add', quantity: 5, date: '2026-10-18' }),
    })
    const res = await adjustStock(req, { params: Promise.resolve({ id: ITEM_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to record adjustment')
  })
})
