/**
 * Global test setup for Vitest.
 * Runs before every test file.
 *
 * - Sets required environment variables so modules that import Supabase clients
 *   don't throw at import time (all actual Supabase calls are mocked in tests).
 * - Resets all mocks between tests.
 */

import { vi, afterEach } from 'vitest'

// Supabase env vars (dummy values — real network calls are always mocked)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

afterEach(() => {
  vi.clearAllMocks()
})

