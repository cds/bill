/**
 * Shared mock factory for Supabase fluent query builder.
 *
 * Usage in test files:
 *   import { createSupabaseMock, mockChain } from '../__mocks__/supabase'
 *   vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: () => createSupabaseMock() }))
 *
 * `mockChain(overrides)` returns a jest-compatible object that satisfies the
 * Supabase fluent API: .from().select().eq().single() etc.
 * Override individual method return values per test using `mockResolvedValueOnce`.
 */

import { vi } from 'vitest'

/** Returns a Supabase-like chainable mock where every terminal method resolves to `{ data: null, error: null }` by default. */
export function createChain(overrides: Record<string, unknown> = {}) {
  const terminal = { data: null, error: null }

  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(terminal),
    maybeSingle: vi.fn().mockResolvedValue(terminal),
    then: undefined, // makes the chain itself NOT awaitable until a terminal is hit
    // Make the chain itself awaitable (for cases like `await supabase.from().select()`)
    ...terminal,
    ...overrides,
  }

  // Allow awaiting the chain directly (resolves to terminal)
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' })
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(terminal).then(resolve)

  return chain
}

/** Returns a mock Supabase client with a configurable `from()` implementation. */
export function createSupabaseMock(fromImpl?: (table: string) => unknown) {
  return {
    from: vi.fn().mockImplementation(fromImpl ?? (() => createChain())),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

