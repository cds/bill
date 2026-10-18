/**
 * Tests: /api/parties and /api/parties/[id]
 *
 * Covers test IDs: P-01 → P-22
 *
 * Scenarios:
 *  - GET /api/parties: list, ?type filter, ?search filter, combined filters, error handling
 *  - POST /api/parties: create with all fields, minimal fields, validation (name, type),
 *                       missing tenant header (403), RLS / error code handling (42501 -> 403, 500)
 *  - GET /api/parties/[id]: fetch party (200), not found (404), error (500)
 *  - PATCH /api/parties/[id]: update fields (200), update error (500)
 *  - DELETE /api/parties/[id]: blocked when invoices exist (400), allowed when no invoices (204),
 *                             invoice check failure (500), delete failure (500)
 *  - Actor coverage: Super User, Business User (tenant_admin), Worker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getParties, POST as createParty } from '@/app/api/parties/route'
import { GET as getPartyById, PATCH as updateParty, DELETE as deleteParty } from '@/app/api/parties/[id]/route'

const TENANT_ID = 'tenant-uuid-111'
const PARTY_ID = 'party-uuid-222'

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

describe('GET /api/parties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // P-01
  it('P-01: Business User and Worker list all parties (200)', async () => {
    const mockParties = [
      { id: 'p1', name: 'Alpha Traders', type: 'customer', tenant_id: TENANT_ID },
      { id: 'p2', name: 'Beta Suppliers', type: 'supplier', tenant_id: TENANT_ID },
    ]
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: mockParties, error: null }))

    const req = new NextRequest('http://localhost/api/parties', {
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'worker' },
    })

    const res = await getParties(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  // P-02 & P-03
  it('P-02 & P-03: Filters by ?type query param', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: [], error: null }))

    const req = new NextRequest('http://localhost/api/parties?type=supplier')
    const res = await getParties(req)

    expect(res.status).toBe(200)
    const chain = mockFrom.mock.results[0].value
    expect((chain.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([['type', 'supplier']])
    )
  })

  // P-04 & P-05
  it('P-04 & P-05: Applies ?search and combines with ?type', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: [], error: null }))

    const req = new NextRequest('http://localhost/api/parties?type=customer&search=acme')
    const res = await getParties(req)

    expect(res.status).toBe(200)
    const chain = mockFrom.mock.results[0].value
    expect((chain.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([['type', 'customer']])
    )
    expect((chain.ilike as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([['name', '%acme%']])
    )
  })

  // P-06
  it('P-06: Returns 500 when Supabase query fails', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Database failure' } }))

    const req = new NextRequest('http://localhost/api/parties')
    const res = await getParties(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Database failure')
  })
})

describe('POST /api/parties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // P-07
  it('P-07: Business User creates party with all valid fields (201)', async () => {
    const created = {
      id: PARTY_ID,
      name: 'Global Mart',
      phone: '1234567890',
      address: '123 Main St',
      type: 'customer',
      tenant_id: TENANT_ID,
    }
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: created, error: null }))

    const req = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'tenant_admin' },
      body: JSON.stringify({
        name: 'Global Mart',
        phone: '1234567890',
        address: '123 Main St',
        type: 'customer',
      }),
    })

    const res = await createParty(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe(PARTY_ID)
    expect(body.name).toBe('Global Mart')
  })

  // P-08 & P-10
  it('P-08 & P-10: Creates party with minimal fields and supplier type', async () => {
    const created = {
      id: PARTY_ID,
      name: 'Logistics Pro',
      phone: null,
      address: null,
      type: 'supplier',
      tenant_id: TENANT_ID,
    }
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: created, error: null }))

    const req = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        name: 'Logistics Pro',
        type: 'supplier',
      }),
    })

    const res = await createParty(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.type).toBe('supplier')
  })

  // P-09 & P-12
  it('P-09 & P-12: Missing x-tenant-id (Unauthenticated or Super User) returns 403', async () => {
    const req = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme' }),
    })

    const res = await createParty(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Tenant context is missing')
  })

  // P-11: Validation failures
  it('P-11: Returns 400 for empty name or invalid type', async () => {
    const reqEmptyName = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: '   ' }),
    })
    const resEmpty = await createParty(reqEmptyName)
    expect(resEmpty.status).toBe(400)
    expect((await resEmpty.json()).error).toBe('Name is required')

    const reqInvalidType = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: 'Valid Name', type: 'invalid_type' }),
    })
    const resType = await createParty(reqInvalidType)
    expect(resType.status).toBe(400)
    expect((await resType.json()).error).toBe('Type must be customer or supplier')
  })

  // P-13: Database error mapping
  it('P-13: Maps Postgres error 42501 to 403 and others to 500', async () => {
    mockFrom = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { code: '42501', message: 'RLS violation' } })
    )

    const req1 = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: 'Test Party' }),
    })
    const res1 = await createParty(req1)
    expect(res1.status).toBe(403)

    mockFrom = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { code: '23505', message: 'Unique constraint error' } })
    )
    const req2 = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ name: 'Test Party' }),
    })
    const res2 = await createParty(req2)
    expect(res2.status).toBe(500)
  })
})

describe('GET /api/parties/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // P-14
  it('P-14: Returns party by id (200)', async () => {
    const mockParty = { id: PARTY_ID, name: 'Acme Party', tenant_id: TENANT_ID }
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: mockParty, error: null }))

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`)
    const res = await getPartyById(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(PARTY_ID)
  })

  // P-15
  it('P-15: Returns 404 when party is null / not found', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`)
    const res = await getPartyById(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Party not found')
  })

  it('P-15b: Returns 500 when query produces a DB error', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'DB read error' } }))

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`)
    const res = await getPartyById(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('DB read error')
  })
})

describe('PATCH /api/parties/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // P-16
  it('P-16: Updates party and returns updated record (200)', async () => {
    const updated = { id: PARTY_ID, name: 'Acme Updated', phone: '9999999999' }
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: updated, error: null }))

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Acme Updated', phone: '9999999999' }),
    })
    const res = await updateParty(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.name).toBe('Acme Updated')
  })

  // P-17
  it('P-17: Returns 500 on update error', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Update failed' } }))

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Failing Update' }),
    })
    const res = await updateParty(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Update failed')
  })
})

describe('DELETE /api/parties/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // P-18
  it('P-18: Rejects delete with 400 when party has existing invoices', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: [{ id: 'invoice-1' }], error: null })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`, { method: 'DELETE' })
    const res = await deleteParty(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Cannot delete party with existing invoices')
  })

  // P-19 & P-22
  it('P-19 & P-22: Deletes party with 204 when no invoices exist (Business User & Worker)', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'parties') {
        return makeChain({ data: null, error: null })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'worker' },
    })
    const res = await deleteParty(req, { params: Promise.resolve({ id: PARTY_ID }) })

    expect(res.status).toBe(204)
  })

  // P-20
  it('P-20: Returns 500 when checking for linked invoices fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: null, error: { message: 'Invoices check failure' } })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`, { method: 'DELETE' })
    const res = await deleteParty(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Invoices check failure')
  })

  // P-21
  it('P-21: Returns 500 when party delete query fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return makeChain({ data: [], error: null })
      }
      if (table === 'parties') {
        return makeChain({ data: null, error: { message: 'Delete party failed' } })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest(`http://localhost/api/parties/${PARTY_ID}`, { method: 'DELETE' })
    const res = await deleteParty(req, { params: Promise.resolve({ id: PARTY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Delete party failed')
  })
})

