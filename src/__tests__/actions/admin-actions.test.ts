/**
 * Tests: src/app/actions/admin-actions.ts
 *
 * Covers test IDs: A-01 → A-16
 *
 * Server Actions tested:
 *  - createTenant(name, status)
 *  - updateTenant(id, name, status)
 *  - deleteTenant(id)
 *  - addTenantMember(tenant_id, user_id, role)
 *
 * Scenarios & RBAC:
 *  - Unauthenticated (no session user) -> { error: 'Unauthorized' }
 *  - Business User / Worker (system_role !== 'super_admin') -> { error: 'Forbidden' }
 *  - Super User (system_role === 'super_admin') -> Allowed { success: true }
 *  - Specific error code mapping in addTenantMember:
 *      - 23503 -> 'User UUID not found in the system.'
 *      - 23505 -> 'User is already a member of this tenant.'
 *  - Cache revalidation checks (revalidatePath)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revalidatePath } from 'next/cache'
import {
  createTenant,
  updateTenant,
  deleteTenant,
  addTenantMember
} from '@/app/actions/admin-actions'

const SUPER_USER_ID = 'super-user-uuid-000'
const REGULAR_USER_ID = 'regular-user-uuid-111'
const TENANT_ID = 'tenant-uuid-222'

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
let mockGetUser: ReturnType<typeof vi.fn>

// Mock @supabase/ssr createServerClient
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

/** Set up authentication state helper */
function setupAuth(role: 'super_admin' | 'user' | 'none') {
  if (role === 'none') {
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    return
  }

  const userId = role === 'super_admin' ? SUPER_USER_ID : REGULAR_USER_ID
  mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id: userId, email: `${role}@test.com` } },
    error: null,
  })

  // Mock table handlers
  mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      return makeChain({
        data: { system_role: role },
        error: null,
      })
    }
    // Default success for other tables (tenants, tenant_members)
    return makeChain({ data: null, error: null })
  })
}

describe('admin-actions: RBAC Gatekeeping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // A-02 & A-16
  it('A-02 & A-16: Returns { error: "Unauthorized" } when user is unauthenticated', async () => {
    setupAuth('none')

    const resCreate = await createTenant('New Tenant', 'active')
    expect(resCreate).toEqual({ error: 'Unauthorized' })

    const resMember = await addTenantMember(TENANT_ID, 'user-1', 'worker')
    expect(resMember).toEqual({ error: 'Unauthorized' })
  })

  // A-03, A-04, A-07, A-10, A-15
  it('A-03, A-04, A-07, A-10, A-15: Returns { error: "Forbidden" } for non-super_admin users', async () => {
    setupAuth('user') // simulated Business User / Worker

    const resCreate = await createTenant('New Tenant', 'active')
    expect(resCreate).toEqual({ error: 'Forbidden' })

    const resUpdate = await updateTenant(TENANT_ID, 'Updated Tenant', 'active')
    expect(resUpdate).toEqual({ error: 'Forbidden' })

    const resDelete = await deleteTenant(TENANT_ID)
    expect(resDelete).toEqual({ error: 'Forbidden' })

    const resAddMember = await addTenantMember(TENANT_ID, 'user-1', 'worker')
    expect(resAddMember).toEqual({ error: 'Forbidden' })
  })
})

describe('admin-actions: createTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth('super_admin')
  })

  // A-01
  it('A-01: Super User creates tenant successfully and revalidates /admin/tenants', async () => {
    let insertedData: unknown = null
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenants') {
        const chain = makeChain({ data: null, error: null })
        chain.insert = vi.fn().mockImplementation((payload) => {
          insertedData = payload
          return chain
        })
        return chain
      }
      return makeChain({ data: null, error: null })
    })

    const res = await createTenant('Acme Corp', 'active')

    expect(res).toEqual({ success: true })
    expect(insertedData).toEqual({ name: 'Acme Corp', status: 'active' })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tenants')
  })

  // A-05
  it('A-05: Returns error when database insert fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenants') {
        return makeChain({ data: null, error: { message: 'Duplicate tenant name' } })
      }
      return makeChain({ data: null, error: null })
    })

    const res = await createTenant('Duplicate Corp', 'active')

    expect(res).toEqual({ error: 'Duplicate tenant name' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('admin-actions: updateTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth('super_admin')
  })

  // A-06
  it('A-06: Super User updates tenant and revalidates /admin/tenants', async () => {
    let updatePayload: unknown = null
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenants') {
        const chain = makeChain({ data: null, error: null })
        chain.update = vi.fn().mockImplementation((payload) => {
          updatePayload = payload
          return chain
        })
        return chain
      }
      return makeChain({ data: null, error: null })
    })

    const res = await updateTenant(TENANT_ID, 'Acme Renewed', 'suspended')

    expect(res).toEqual({ success: true })
    expect(updatePayload).toEqual({ name: 'Acme Renewed', status: 'suspended' })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tenants')
  })

  // A-08
  it('A-08: Returns error when tenant update query fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenants') {
        return makeChain({ data: null, error: { message: 'Update failed' } })
      }
      return makeChain({ data: null, error: null })
    })

    const res = await updateTenant(TENANT_ID, 'Acme Renewed', 'suspended')

    expect(res).toEqual({ error: 'Update failed' })
  })
})

describe('admin-actions: deleteTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth('super_admin')
  })

  // A-09
  it('A-09: Super User deletes tenant successfully and revalidates /admin/tenants', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenants') {
        return makeChain({ data: null, error: null })
      }
      return makeChain({ data: null, error: null })
    })

    const res = await deleteTenant(TENANT_ID)

    expect(res).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tenants')
  })

  // A-11
  it('A-11: Returns error when delete query fails', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenants') {
        return makeChain({ data: null, error: { message: 'Foreign key constraint prevents deletion' } })
      }
      return makeChain({ data: null, error: null })
    })

    const res = await deleteTenant(TENANT_ID)

    expect(res).toEqual({ error: 'Foreign key constraint prevents deletion' })
  })
})

describe('admin-actions: addTenantMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth('super_admin')
  })

  // A-12
  it('A-12: Super User adds member successfully, revalidates /admin/tenants and /team', async () => {
    let memberData: unknown = null
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenant_members') {
        const chain = makeChain({ data: null, error: null })
        chain.insert = vi.fn().mockImplementation((payload) => {
          memberData = payload
          return chain
        })
        return chain
      }
      return makeChain({ data: null, error: null })
    })

    const res = await addTenantMember(TENANT_ID, REGULAR_USER_ID, 'tenant_admin')

    expect(res).toEqual({ success: true })
    expect(memberData).toEqual({
      tenant_id: TENANT_ID,
      user_id: REGULAR_USER_ID,
      role: 'tenant_admin',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tenants')
    expect(revalidatePath).toHaveBeenCalledWith('/team')
  })

  // A-13
  it('A-13: Maps Postgres error 23503 to "User UUID not found in the system."', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenant_members') {
        return makeChain({ data: null, error: { code: '23503', message: 'FK violation' } })
      }
      return makeChain({ data: null, error: null })
    })

    const res = await addTenantMember(TENANT_ID, 'non-existent-uuid', 'worker')

    expect(res).toEqual({ error: 'User UUID not found in the system.' })
  })

  // A-14
  it('A-14: Maps Postgres error 23505 to "User is already a member of this tenant."', async () => {
    mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return makeChain({ data: { system_role: 'super_admin' }, error: null })
      }
      if (table === 'tenant_members') {
        return makeChain({ data: null, error: { code: '23505', message: 'Unique violation' } })
      }
      return makeChain({ data: null, error: null })
    })

    const res = await addTenantMember(TENANT_ID, REGULAR_USER_ID, 'worker')

    expect(res).toEqual({ error: 'User is already a member of this tenant.' })
  })
})

