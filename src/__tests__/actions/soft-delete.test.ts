/**
 * Tests: src/app/actions/soft-delete.ts
 *
 * Covers test IDs: S-01 → S-10
 *
 * Scenarios:
 *  - S-01: Soft delete 'invoices' -> sets deleted_at, revalidates '/sales'
 *  - S-02: Soft delete 'parties' -> sets deleted_at, revalidates '/parties'
 *  - S-03: Soft delete 'items' -> sets deleted_at, revalidates '/items'
 *  - S-04: Soft delete 'expenses' -> sets deleted_at, revalidates '/expenses'
 *  - S-05: Soft delete 'invoice_items' -> sets deleted_at, revalidates '/invoice_items'
 *  - S-06: Soft delete 'stock_adjustments' -> sets deleted_at, revalidates '/stock_adjustments'
 *  - S-07: Table name security allowlist validation:
 *          Rejects unauthorized tables ('users', 'tenants', 'auth', etc.) with error
 *  - S-08: Non-existent ID (no rows updated, but no error thrown by DB) -> { success: true }
 *  - S-09: Database error (e.g. trigger / RLS error) returns { error: error.message }
 *  - S-10: Path revalidation mapping accuracy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revalidatePath } from 'next/cache'
import { softDeleteRecord } from '@/app/actions/soft-delete'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let mockFrom: ReturnType<typeof vi.fn>

// Mock @supabase/ssr createServerClient
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
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

describe('softDeleteRecord Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))
  })

  // S-01
  it('S-01: Soft-deleting an invoice revalidates /sales and updates deleted_at', async () => {
    let capturedUpdate: Record<string, unknown> | null = null
    mockFrom = vi.fn().mockImplementation((table: string) => {
      const chain = makeChain({ data: null, error: null })
      chain.update = vi.fn().mockImplementation((payload) => {
        capturedUpdate = payload
        return chain
      })
      return chain
    })

    const res = await softDeleteRecord('invoices', 'inv-123')

    expect(res).toEqual({ success: true })
    expect(mockFrom).toHaveBeenCalledWith('invoices')
    expect(capturedUpdate).toBeDefined()
    expect(typeof capturedUpdate!.deleted_at).toBe('string')
    expect(revalidatePath).toHaveBeenCalledWith('/sales')
  })

  // S-02
  it('S-02: Soft-deleting a party revalidates /parties', async () => {
    const res = await softDeleteRecord('parties', 'party-123')

    expect(res).toEqual({ success: true })
    expect(mockFrom).toHaveBeenCalledWith('parties')
    expect(revalidatePath).toHaveBeenCalledWith('/parties')
  })

  // S-03
  it('S-03: Soft-deleting an item revalidates /items', async () => {
    const res = await softDeleteRecord('items', 'item-123')

    expect(res).toEqual({ success: true })
    expect(mockFrom).toHaveBeenCalledWith('items')
    expect(revalidatePath).toHaveBeenCalledWith('/items')
  })

  // S-04
  it('S-04: Soft-deleting an expense revalidates /expenses', async () => {
    const res = await softDeleteRecord('expenses', 'exp-123')

    expect(res).toEqual({ success: true })
    expect(mockFrom).toHaveBeenCalledWith('expenses')
    expect(revalidatePath).toHaveBeenCalledWith('/expenses')
  })

  // S-05 & S-06
  it('S-05 & S-06: Soft-deleting invoice_items and stock_adjustments succeeds', async () => {
    const res1 = await softDeleteRecord('invoice_items', 'ii-123')
    expect(res1).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/invoice_items')

    const res2 = await softDeleteRecord('stock_adjustments', 'sa-123')
    expect(res2).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/stock_adjustments')
  })

  // S-07
  it('S-07: Rejects unauthorized tables with strict security error', async () => {
    const unauthorizedTables = ['users', 'tenants', 'tenant_members', 'audit_logs', 'schema_migrations', '../secrets']

    for (const table of unauthorizedTables) {
      const res = await softDeleteRecord(table, 'some-id')
      expect(res).toEqual({ error: 'Invalid table name provided for soft deletion.' })
    }

    // Database should never have been queried
    expect(mockFrom).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // S-08
  it('S-08: Non-existent ID returns { success: true } if DB does not error', async () => {
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))

    const res = await softDeleteRecord('items', 'non-existent-uuid')

    expect(res).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/items')
  })

  // S-09
  it('S-09: Returns error object when DB update operation fails (e.g. trigger/RLS block)', async () => {
    mockFrom = vi.fn().mockReturnValue(
      makeChain({ data: null, error: { message: 'Soft delete blocked: only tenant_admin can soft-delete' } })
    )

    const res = await softDeleteRecord('items', 'item-123')

    expect(res).toEqual({ error: 'Soft delete blocked: only tenant_admin can soft-delete' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // S-10
  it('S-10: Correctly targets the "sales" path only for "invoices", and direct table names for all others', async () => {
    await softDeleteRecord('invoices', 'id-1')
    expect(revalidatePath).toHaveBeenCalledWith('/sales')

    vi.clearAllMocks()
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))

    await softDeleteRecord('items', 'id-2')
    expect(revalidatePath).toHaveBeenCalledWith('/items')
    expect(revalidatePath).not.toHaveBeenCalledWith('/sales')
  })
})

