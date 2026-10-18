@AGENTS.md

---

# Testing Context — Bill App

> This section documents the testing setup, conventions, and step-by-step test writing plan for AI assistants working on this codebase.

## Test Framework

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit / integration test runner |
| **vite-tsconfig-paths** | Resolves `@/` path aliases in tests |
| `src/__tests__/setup.ts` | Global setup: seeds env vars, resets mocks after each test |
| `src/__tests__/__mocks__/supabase.ts` | Reusable Supabase fluent mock factory |

### Key Commands
```bash
npm run test           # Watch mode
npm run test:run       # Single run (CI)
npm run test:coverage  # Generates terminal & interactive HTML report in coverage/index.html
npx vitest run --reporter=verbose  # Verbose single run
```

### Config File
`vitest.config.mts` at project root — `environment: 'node'`, globals enabled, aliases resolved via `vite-tsconfig-paths`.

---

## User Types Under Test

| Label | `system_role` | `tenant_role` | Simulated By |
|-------|--------------|--------------|--------------|
| **Super User** | `super_admin` | — | Headers: no `x-tenant-id`; DB returns `system_role: 'super_admin'` |
| **Business User** | `user` | `tenant_admin` | Headers: `x-tenant-id` set; DB tenant_members role = `tenant_admin` |
| **User (Worker)** | `user` | `worker` | Headers: `x-tenant-id` set; DB tenant_members role = `worker` |
| **Unauthenticated** | — | — | No session / no headers |

---

## How API Route Tests Work

Next.js App Router route handlers (`route.ts`) export named async functions (`GET`, `POST`, etc.).  
We import them directly and call them with a mocked `NextRequest`:

```ts
import { GET, POST } from '@/app/api/invoices/route'
import { NextRequest } from 'next/server'

const req = new NextRequest('http://localhost/api/invoices', {
  method: 'POST',
  headers: { 'x-tenant-id': 'tenant-uuid' },
  body: JSON.stringify({ ... }),
})
const res = await POST(req)
expect(res.status).toBe(201)
```

Supabase clients used inside route handlers are mocked using `vi.mock(...)`:

```ts
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => mockClient,
}))
```

---

## How Server Action Tests Work

Server actions (`'use server'`) are plain async functions — import and call directly:

```ts
import { createTenant } from '@/app/actions/admin-actions'

// Mock the Supabase client used inside
vi.mock('@/lib/supabase/server', ...)

const result = await createTenant('Acme Corp', 'active')
expect(result).toEqual({ success: true })
```

---

## Test File Locations

```
src/__tests__/
├── setup.ts                         # Global setup (env + mock resets)
├── __mocks__/
│   └── supabase.ts                  # Reusable Supabase mock factory
├── api/
│   ├── health.test.ts               # Step 2
│   ├── invoices.test.ts             # Step 3 (GET + POST)
│   ├── invoices-id.test.ts          # Step 4 (GET[id] + DELETE[id])
│   ├── parties.test.ts              # Step 5
│   ├── items.test.ts                # Step 6
│   └── expenses.test.ts             # Step 7
└── actions/
    ├── admin-actions.test.ts        # Step 8
    └── soft-delete.test.ts          # Step 9
```

---

## Step-by-Step Test Writing Plan

| Step | File | Test IDs Covered | Status |
|------|------|-----------------|--------|
| 1 | Setup + config + CLAUDE.md | — | ✅ Done |
| 2 | `api/health.test.ts` | H-01, H-02 | ✅ Done |
| 3 | `api/invoices.test.ts` | I-01 → I-16 | ✅ Done |
| 4 | `api/invoices-id.test.ts` | I-17 → I-25 | ✅ Done |
| 5 | `api/parties.test.ts` | P-01 → P-22 | ✅ Done |
| 6 | `api/items.test.ts` | IT-01 → IT-23 | ✅ Done |
| 7 | `api/expenses.test.ts` | E-01 → E-06 | ✅ Done |
| 8 | `actions/admin-actions.test.ts` | A-01 → A-16 | ✅ Done |
| 9 | `actions/soft-delete.test.ts` | S-01 → S-10 | ✅ Done |
| 10 | `middleware.test.ts` + Full Suite Run | M-01 → M-11 | ✅ Done (102/102 Passing) |

**Rule:** Each step = write one file + run it before moving to the next step.

---

## RBAC & Auth Architecture (Quick Ref)

- **Middleware** (`src/middleware.ts`): Injects `x-tenant-id`, `x-tenant-role`, `x-system-role` headers for every authenticated dashboard request.
- **API mutations** check for `x-tenant-id` header → `403` if missing.
- **API reads** rely on Supabase RLS only.
- **Admin Server Actions** (`admin-actions.ts`) re-validate `system_role === 'super_admin'` in `getAdminSupabase()` — never trust middleware alone.
- **soft-delete.ts** relies only on session + RLS — no explicit role check.
- **`/team` page** checks `x-tenant-role === 'tenant_admin'` — workers see a "no permission" message.

### Tenant Roles
- `tenant_admin` — full access incl. soft-delete, team management
- `worker` — read/write business data but blocked from delete + team
- `distributor` — same isolation as worker (mentioned in CONTEXT.md)

---

## Important Next.js 16 / React 19 Notes (from CONTEXT.md)
- `params` and `searchParams` in pages/routes are **Promises** — always `await` them.
- `cookies()` and `headers()` from `next/headers` are **async**.
- Use `@supabase/ssr` (not deprecated `@supabase/auth-helpers-nextjs`).
- Use `getUser()` not `getSession()` for server-side auth validation.

