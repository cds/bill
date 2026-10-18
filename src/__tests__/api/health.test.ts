/**
 * Tests: GET /api/health
 *
 * Covers: H-01, H-02
 * - H-01: Health check with no auth → 200 { status: 'ok', timestamp }
 * - H-02: Health check while authenticated → 200 (same — no auth check on this route)
 *
 * Strategy: The health route has no Supabase dependency so no mocking is needed.
 * We import the handler directly and call it with a plain NextRequest.
 */

import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { NextRequest } from 'next/server'

describe('GET /api/health', () => {
  // H-01 — no auth, unauthenticated caller
  it('H-01: returns 200 with status ok and an ISO timestamp (unauthenticated)', async () => {
    const req = new NextRequest('http://localhost/api/health')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    // Validate it is a valid ISO 8601 date string
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow()
  })

  // H-02 — authenticated caller (same route, no change in behaviour)
  it('H-02: returns 200 with status ok when called by an authenticated user', async () => {
    // Simulating an authenticated request by adding an Authorization header.
    // The route ignores auth entirely — result must be identical.
    const req = new NextRequest('http://localhost/api/health', {
      headers: {
        Authorization: 'Bearer some-valid-token',
        'x-tenant-id': 'tenant-uuid-123',
        'x-tenant-role': 'tenant_admin',
      },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})

