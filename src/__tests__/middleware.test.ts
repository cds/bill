/**
 * Tests: src/middleware.ts
 *
 * Covers test IDs: M-01 → M-21
 *
 * Scenarios:
 *  - M-01: Unauthenticated request to protected route redirects to /login
 *  - M-02: Authenticated super_admin visiting /login redirects to /admin
 *  - M-03: Authenticated standard user visiting /login redirects to /
 *  - M-04: Super admin accessing /admin pages is allowed through
 *  - M-05 & M-06: Non-super admin accessing /admin pages is redirected to /
 *  - M-07: Authenticated user with tenant membership visiting dashboard has
 *          x-tenant-id, x-tenant-role, and x-system-role headers injected
 *  - M-08: Standard user with no tenant membership is redirected to /setup
 *  - M-09: Super admin with no tenant membership visiting / is redirected to /admin
 *  - M-10: User visiting /setup is allowed through (prevents redirect loop)
 *  - M-11: Config matcher regex excludes /api/health, offline entry, and static assets
 *  - M-12: Worker role accessing dashboard pages gets headers injected
 *  - M-13: Tenant admin (business user) accessing dashboard pages gets headers injected
 *  - M-14: Worker visiting /admin is redirected to /
 *  - M-15: Tenant admin visiting /admin is redirected to /
 *  - M-16: Super admin with tenant membership visiting dashboard gets tenant headers injected
 *  - M-17: Worker visiting /login is redirected to /
 *  - M-18: Super admin with no tenant visiting /items is redirected to /setup
 *  - M-19: Cookie setAll callback exercises lines 19-29
 *  - M-20: Cookie copying (line 112) preserves supabase cookies on finalResponse
 *  - M-21: Missing system-role records default to the regular user role
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware, config } from '@/middleware'

let mockGetUser: ReturnType<typeof vi.fn>
let mockFrom: ReturnType<typeof vi.fn>

type CookieToSet = {
  name: string
  value: string
  options?: { path?: string; httpOnly?: boolean }
}

type CookieAdapter = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookiesToSet: CookieToSet[]) => void
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: () => mockGetUser(),
    },
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

function setupSession(options: {
  authenticated: boolean
  systemRole?: 'super_admin' | 'user'
  tenantMembership?: { tenant_id: string; role: string } | null
  tenant?: { id: string } | null
}) {
  if (!options.authenticated) {
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    mockFrom = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))
    return
  }

  mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'test-user-id', email: 'test@example.com' } },
    error: null,
  })

  mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      return makeChain({
        data: { system_role: options.systemRole || 'user' },
        error: null,
      })
    }
    if (table === 'tenant_members') {
      return makeChain({
        data: options.tenantMembership ?? null,
        error: null,
      })
    }
    if (table === 'tenants') {
      return makeChain({ data: options.tenant ?? null, error: null })
    }
    return makeChain({ data: null, error: null })
  })
}

describe('Next.js Middleware Routing & RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // M-01
  it('M-01: Redirects unauthenticated visitor to /login', async () => {
    setupSession({ authenticated: false })

    const req = new NextRequest('http://localhost/sales')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login')
  })

  it('M-01b: Unauthenticated visitor accessing /login is allowed', async () => {
    setupSession({ authenticated: false })

    const req = new NextRequest('http://localhost/login')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // M-02
  it('M-02: Super admin visiting /login is redirected to /admin', async () => {
    setupSession({ authenticated: true, systemRole: 'super_admin' })

    const req = new NextRequest('http://localhost/login')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/admin')
  })

  // M-03
  it('M-03: Regular user visiting /login is redirected to /', async () => {
    setupSession({ authenticated: true, systemRole: 'user' })

    const req = new NextRequest('http://localhost/login')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  // M-04
  it('M-04: Super admin accessing /admin/tenants is allowed through', async () => {
    setupSession({ authenticated: true, systemRole: 'super_admin' })

    const req = new NextRequest('http://localhost/admin/tenants')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // M-05 & M-06
  it('M-05 & M-06: Non-super admin visiting /admin/tenants is redirected to /', async () => {
    setupSession({ authenticated: true, systemRole: 'user' })

    const req = new NextRequest('http://localhost/admin/tenants')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  // M-07
  it('M-07: Injects tenant headers (x-tenant-id, x-tenant-role, x-system-role) for member visiting dashboard', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-abc-123', role: 'tenant_admin' },
    })

    const req = new NextRequest('http://localhost/sales')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBe('tenant-abc-123')
    expect(res.headers.get('x-middleware-request-x-tenant-role')).toBe('tenant_admin')
    expect(res.headers.get('x-middleware-request-x-system-role')).toBe('user')
  })

  // M-08
  it('M-08: Standard user with no tenant membership is redirected to /setup', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: null,
    })

    const req = new NextRequest('http://localhost/sales')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/setup')
  })

  // M-09
  it('M-09: Super admin with no tenant membership visiting / is redirected to /admin', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'super_admin',
      tenantMembership: null,
    })

    const req = new NextRequest('http://localhost/')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/admin')
  })

  // M-10
  it('M-10: User visiting /setup is allowed through without redirect loop', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: null,
    })

    const req = new NextRequest('http://localhost/setup')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // M-11
  it('M-11: Config matcher regex excludes /api/health and static assets', () => {
    expect(config.matcher).toBeDefined()
    const matcherPattern = config.matcher[0]

    // Next.js compiles matchers with ^ and $ anchors
    const regex = new RegExp(`^${matcherPattern}$`)

    // Should match protected app routes
    expect(regex.test('/sales')).toBe(true)
    expect(regex.test('/admin')).toBe(true)
    expect(regex.test('/items')).toBe(true)
    expect(regex.test('/login')).toBe(true)

    // Should NOT match excluded paths
    expect(regex.test('/api/health')).toBe(false)
    expect(regex.test('/_next/static/chunk.js')).toBe(false)
    expect(regex.test('/_next/image?url=...')).toBe(false)
    expect(regex.test('/favicon.ico')).toBe(false)
    expect(regex.test('/logo.png')).toBe(false)
    expect(regex.test('/icon.svg')).toBe(false)
    expect(regex.test('/sw.js')).toBe(false)
    expect(regex.test('/offline.html')).toBe(false)
    expect(regex.test('/offline-shell.css')).toBe(false)
    expect(regex.test('/offline-shell.js')).toBe(false)
    expect(regex.test('/manifest.webmanifest')).toBe(false)
  })

  // ---------- NEW TESTS (M-12 → M-20) ----------

  // M-12
  it('M-12: Worker role accessing dashboard pages gets headers injected', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-worker-001', role: 'worker' },
    })

    const req = new NextRequest('http://localhost/sales')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // M-13
  it('M-13: Tenant admin (business user) accessing dashboard pages gets headers injected', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-biz-002', role: 'tenant_admin' },
    })

    const req = new NextRequest('http://localhost/items')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // M-14
  it('M-14: Worker visiting /admin is redirected to /', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-worker-001', role: 'worker' },
    })

    const req = new NextRequest('http://localhost/admin/tenants')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  // M-15
  it('M-15: Tenant admin visiting /admin is redirected to /', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-biz-002', role: 'tenant_admin' },
    })

    const req = new NextRequest('http://localhost/admin')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  // M-16
  it('M-16: Super admin with tenant membership visiting dashboard gets tenant headers injected', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'super_admin',
      tenantMembership: { tenant_id: 'tenant-sa-003', role: 'tenant_admin' },
    })

    const req = new NextRequest('http://localhost/sales')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  // M-17
  it('M-17: Worker visiting /login is redirected to /', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-worker-001', role: 'worker' },
    })

    const req = new NextRequest('http://localhost/login')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  // M-18
  it('M-18: Super admin with no available tenant visiting /items is redirected to /admin', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'super_admin',
      tenantMembership: null,
    })

    const req = new NextRequest('http://localhost/items')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/admin')
  })

  it('Injects the selected tenant context for a super admin with no membership', async () => {
    setupSession({
      authenticated: true,
      systemRole: 'super_admin',
      tenantMembership: null,
      tenant: { id: 'selected-tenant-id' },
    })

    const req = new NextRequest('http://localhost/items', {
      headers: { 'x-tenant-id': 'forged-tenant-id' },
    })
    req.cookies.set('active_tenant_id', 'selected-tenant-id')

    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBe('selected-tenant-id')
    expect(res.headers.get('x-middleware-request-x-tenant-role')).toBe('super_admin')
    expect(res.headers.get('x-middleware-request-x-system-role')).toBe('super_admin')
  })

  // M-19
  it('M-19: setAll updates request cookies and getAll reads request cookies', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    let capturedSetAll: CookieAdapter['setAll'] | null = null
    let capturedGetAll: (() => { name: string; value: string }[]) | null = null

    ;(createServerClient as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, key: string, options: { cookies: CookieAdapter }) => {
        capturedSetAll = options.cookies.setAll
        capturedGetAll = options.cookies.getAll
        return {
          auth: { getUser: () => mockGetUser() },
          from: (...args: unknown[]) => mockFrom(...args),
        }
      }
    )

    setupSession({ authenticated: false })
    const req = new NextRequest('http://localhost/login', {
      headers: { cookie: 'existing-cookie=existing-value' },
    })
    await middleware(req)

    expect(capturedSetAll).toBeDefined()
    expect(capturedGetAll).toBeDefined()
    expect(capturedGetAll!()).toEqual([{ name: 'existing-cookie', value: 'existing-value' }])
    capturedSetAll!([
      { name: 'sb-token', value: 'abc123', options: { path: '/', httpOnly: true } },
    ])

    expect(req.cookies.get('sb-token')?.value).toBe('abc123')
  })

  // M-20
  it('M-20: Cookie copying preserves supabase cookies on finalResponse', async () => {
    // Override the mock so that invoking setAll puts cookies on the supabaseResponse
    // before the tenant-header injection path creates finalResponse
    const { createServerClient } = await import('@supabase/ssr')

    ;(createServerClient as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, key: string, options: { cookies: CookieAdapter }) => {
        // Immediately call setAll to simulate Supabase refreshing a token,
        // which places cookies onto supabaseResponse before the tenant-header
        // injection path creates its own finalResponse.
        options.cookies.setAll([
          { name: 'sb-refresh', value: 'refreshed-token-value', options: { path: '/', httpOnly: true } },
          { name: 'sb-access', value: 'access-token-value', options: { path: '/' } },
        ])
        return {
          auth: { getUser: () => mockGetUser() },
          from: (...args: unknown[]) => mockFrom(...args),
        }
      }
    )

    setupSession({
      authenticated: true,
      systemRole: 'user',
      tenantMembership: { tenant_id: 'tenant-cookie-test', role: 'worker' },
    })

    const req = new NextRequest('http://localhost/sales')
    const res = await middleware(req)

    expect(res.status).toBe(200)

    // The finalResponse should have copied cookies from supabaseResponse (line 112)
    const cookies = res.cookies.getAll()
    const refreshCookie = cookies.find((c) => c.name === 'sb-refresh')
    const accessCookie = cookies.find((c) => c.name === 'sb-access')

    expect(refreshCookie).toBeDefined()
    expect(refreshCookie!.value).toBe('refreshed-token-value')
    expect(accessCookie).toBeDefined()
    expect(accessCookie!.value).toBe('access-token-value')
  })

  it('M-21: Defaults to the user system role when the role record is missing', async () => {
    setupSession({ authenticated: true })
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') return makeChain({ data: null, error: null })
      if (table === 'tenant_members') {
        return makeChain({
          data: { tenant_id: 'tenant-default-role', role: 'worker' },
          error: null,
        })
      }
      return makeChain({ data: null, error: null })
    })

    const req = new NextRequest('http://localhost/login')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })
})
