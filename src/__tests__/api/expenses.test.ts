/**
 * Tests: GET /api/expenses and POST /api/expenses
 *
 * Covers test IDs: E-01 → E-06
 *
 * Scenarios:
 *  - GET /api/expenses:
 *      - E-01: Lists expenses ordered by date descending (200)
 *      - E-02: Returns 500 on Supabase query error or unexpected throw
 *  - POST /api/expenses:
 *      - E-03: Creates expense with valid fields (201)
 *      - E-04: Rejects missing required fields (date, category, amount, payment_mode) with 400
 *      - E-05: Missing x-tenant-id (Unauthenticated or Super User) returns 403
 *      - E-06: Verifies payment_status is always hardcoded/persisted as 'paid'
 *      - Postgres error 42501 maps to 403, generic DB error to 500
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/expenses/route'

const TENANT_ID = 'tenant-uuid-111'
const EXPENSE_ID = 'expense-uuid-555'

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

describe('GET /api/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // E-01
  it('E-01: Lists all expenses ordered by date descending (200)', async () => {
    const mockExpenses = [
      { id: 'exp-1', date: '2026-10-18', amount: 1500, category: 'Fuel', tenant_id: TENANT_ID },
      { id: 'exp-2', date: '2026-10-15', amount: 3000, category: 'Rent', tenant_id: TENANT_ID },
    ]
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: mockExpenses, error: null }))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].category).toBe('Fuel')
  })

  // E-02
  it('E-02: Returns 500 when Supabase query returns an error', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: { message: 'Database read error' } }))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Database read error')
  })
})

describe('POST /api/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // E-05
  it('E-05: Missing x-tenant-id (Unauthenticated or Super User) returns 403', async () => {
    const req = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-10-18',
        category: 'Supplies',
        amount: 250,
        payment_mode: 'cash',
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Tenant context is missing')
  })

  // E-04
  it('E-04: Returns 400 when required fields are missing', async () => {
    // Missing amount & payment_mode
    const req = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        date: '2026-10-18',
        category: 'Supplies',
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Missing required fields')
  })

  // E-03 & E-06
  it('E-03 & E-06: Creates expense (201) and ensures payment_status is set to "paid"', async () => {
    let capturedInsert: Record<string, unknown>[] | null = null

    const createdExpense = {
      id: EXPENSE_ID,
      tenant_id: TENANT_ID,
      date: '2026-10-18',
      category: 'Utilities',
      amount: 450,
      payment_mode: 'bank_transfer',
      payment_status: 'paid',
      notes: 'Monthly electric bill',
    }

    mockFrom = vi.fn().mockImplementation(() => {
      const chain = makeChain({ data: createdExpense, error: null })
      const origInsert = chain.insert as ReturnType<typeof vi.fn>
      chain.insert = vi.fn().mockImplementation((payload) => {
        capturedInsert = payload
        return chain
      })
      return chain
    })

    const req = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID, 'x-tenant-role': 'tenant_admin' },
      body: JSON.stringify({
        date: '2026-10-18',
        category: 'Utilities',
        amount: '450', // string amount should be parsed to Number(450)
        payment_mode: 'bank_transfer',
        notes: 'Monthly electric bill',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe(EXPENSE_ID)
    expect(capturedInsert).toBeDefined()
    expect(capturedInsert![0].payment_status).toBe('paid')
    expect(capturedInsert![0].amount).toBe(450)
    expect(capturedInsert![0].tenant_id).toBe(TENANT_ID)
  })

  it('E-07: Maps Postgres RLS error code 42501 to 403 status', async () => {
    mockFrom = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { code: '42501', message: 'Permission denied by RLS' } })
    )

    const req = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        date: '2026-10-18',
        category: 'Travel',
        amount: 300,
        payment_mode: 'cash',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Permission denied by RLS')
  })

  it('E-08: Maps generic database error to 500 status', async () => {
    mockFrom = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { code: '23502', message: 'Not null violation' } })
    )

    const req = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        date: '2026-10-18',
        category: 'Travel',
        amount: 300,
        payment_mode: 'cash',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Not null violation')
  })
})

