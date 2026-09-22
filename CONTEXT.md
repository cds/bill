# Bill App — Project Context

> **Last Updated**: 2026-09-05
> **Current Version**: V1 (Core Billing & Inventory) — In Progress
> **Conversation ID**: `96716635-c92e-4241-acce-3de0ac6f8da3`

---

## What This App Is

**Bill** is an SME business accounting, billing, and inventory mobile-first web app for **Eatera Foods** — a snack/food distributor based in Gujarat. Similar to Vyapar/MyBillBook.

### Core Workflows (Full Scope)
1. **Sale & Invoicing** — Invoice creation with sequential numbering, Cash/Credit, party selection, line items, payment tracking
2. **Inventory Management** — Item catalog with stock tracking, adjustments
3. **Expense Tracking** — Categorized expenses (Diesel, Salary, Rent, etc.)
4. **Dashboard & Metrics** — Receivables, Payables, Stock Value, Low Stock alerts
5. **Reports & PDF Export** — Sale Reports, Stock Reports, Party Statements, PDF generation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.4 (App Router, Turbopack) |
| Language | TypeScript |
| UI Components | shadcn/ui (Tailwind CSS v4) + Lucide Icons |
| Database | Supabase (PostgreSQL) |
| Auth (V4) | Supabase Auth |
| PDF (V3) | @react-pdf/renderer |
| Toasts | sonner |
| Hosting (V4) | Vercel |

> **Note**: Bootstrap was deliberately dropped — it conflicts with shadcn/ui's Tailwind CSS. See implementation plan for rationale.

### Key Next.js 16 / React 19 Rules
- `params` and `searchParams` in pages/routes are **Promises** — must `await` them
- `cookies()` and `headers()` from `next/headers` are **async**
- Server Components are default; add `'use client'` only for interactivity
- Use `@supabase/ssr` (not deprecated `@supabase/auth-helpers-nextjs`)
- Use `getUser()` not `getSession()` for auth validation on server

---

## Phased Roadmap

| Version | Scope | Status |
|---------|-------|--------|
| **V1**: Core Billing & Inventory | Item Catalog, Party Management, Add Sale, Invoice saving, Stock deduction | ✅ **Code complete & verified** |
| **V2**: Stock Adjustments & Expenses | Stock In/Out modal, Expense logging, Dashboard metrics, Monthly chart | ✅ **Code complete** |
| **V3**: Reporting & PDF Engine | Sale Report, Stock Detail Report, Party Statement, PDF generation | ✅ **Code complete** |
| **V4**: Auth & Business | Supabase Auth, `businesses` mapping | ✅ **Code complete** |
| **V5**: Multi-Tenant & Soft Delete | `tenants`, `tenant_members`, Super Admin vs Client Admin RBAC, Global Audit Logs | ✅ **Code complete** |

---

### Phase 5 Multi-Tenant & RBAC Analysis (Reference)

The application utilizes a strict, Postgres-enforced Role-Based Access Control (RBAC) architecture.

**1. Database Schema & Triggers:**
- **Users Table** (`public.users`): Stores the global `system_role` (`super_admin` or `user`).
- **Tenants & Members** (`public.tenants`, `public.tenant_members`): Maps users to specific businesses with a `tenant_role` (`tenant_admin`, `distributor`, `worker`).
- **Soft Deletes**: Deletions on core business tables update `deleted_at` instead of hard deleting. A `BEFORE UPDATE` Postgres trigger ensures *only* `tenant_admin` (or `super_admin`) can modify the `deleted_at` column.
- **Audit Logging**: The `005_audit_logs.sql` trigger automatically logs every `INSERT`, `UPDATE`, and `SOFT_DELETE` into an immutable `audit_logs` ledger.
- **Auto-Provisioning**: The `handle_new_user` Postgres trigger ensures that upon sign-up, users are automatically placed into `public.users`, assigned a default `tenant`, and made a `tenant_admin`.

**2. Application Access Levels (What they see):**
- **Super Admin (`system_role = 'super_admin'`)**:
  - **Data Level (RLS)**: Bypasses all Row Level Security. Can read/write every row across all tenants globally. Can view soft-deleted rows and global audit logs.
  - **Application UI**: Has exclusive access to `/admin/tenants` (Global Tenant Management) and `/admin/logs` (Global Audit Ledger). 
  - **Dashboard Usage**: Because the `006` migration backfilled Super Admins with their own default tenant, they also have a valid `tenant_id`. When a Super Admin visits the normal dashboard (`/`, `/sales`), the Next.js Middleware resolves their personal tenant, allowing them to use the app identically to a standard user.
- **Tenant Admin (`tenant_role = 'tenant_admin'`)**:
  - **Data Level (RLS)**: Strictly isolated to rows where `tenant_id` matches their own. Cannot see rows where `deleted_at IS NOT NULL`.
  - **Application UI**: Has exclusive access to `/team` (invite users, assign roles) and `/logs` (scoped view of their own business's audit trail). Can perform Soft Deletes.
- **Tenant Worker / Distributor**:
  - **Data Level (RLS)**: Same row isolation as Tenant Admin. 
  - **Application UI**: Has access to core business flows (`/sales`, `/items`) but is entirely blocked from `/team`, `/logs`, and `/admin`. The Soft Delete trigger blocks them from deleting records.

*All TypeScript errors, Next.js Middleware routing boundaries, and base-ui prop incompatibilities have been resolved. The app compiles cleanly.*

---

## Project Structure

```
bill/
├── .env.local.example          # Supabase credentials template
├── next.config.ts
├── package.json
├── components.json             # shadcn/ui config
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql
└── src/
    ├── app/
    │   ├── layout.tsx          # Root layout (header + bottom nav + toaster)
    │   ├── page.tsx            # Dashboard
    │   ├── globals.css         # Tailwind v4 + shadcn theme (green primary, PDF Print styles)
    │   ├── items/              # Item catalog pages
    │   ├── parties/            # Party management pages
    │   ├── sales/              # Invoice pages (list, new, detail)
    │   ├── expenses/           # Expense tracking pages
    │   ├── reports/            # Reports (sales, expenses, stock, parties)
    │   └── api/                # REST route handlers
    │       ├── items/
    │       ├── parties/
    │       ├── expenses/
    │       └── invoices/
    ├── components/
    │   ├── ui/                 # 20+ shadcn/ui components
    │   ├── layout/             # AppHeader, BottomNav
    │   ├── items/              # ItemCard, ItemForm, ItemsPageClient, StockAdjustmentModal
    │   ├── parties/            # PartyForm, PartySearch
    │   ├── sales/              # InvoiceForm, LineItemRow, ItemSelector, InvoiceActions
    │   ├── expenses/           # ExpenseForm
    │   ├── reports/            # DateRangeFilter, PartySelector, PartyStatementActions
    │   └── shared/             # PageHeader, EmptyState, Currency, StatCard, PrintButton
    └── lib/
        ├── supabase/           # client.ts, server.ts, types.ts
        └── utils.ts            # cn, formatCurrency, formatDate, tempId
```

---

## Setup Instructions (for new sessions)

1. **Supabase**: Create project → run `001_initial_schema.sql` → run `seed.sql`
2. **Env**: Copy `.env.local.example` → `.env.local`, fill in Supabase URL + anon key
3. **Dev**: `npm run dev` (uses Turbopack)
4. **Build**: `npm run build` (needs network for Google Fonts)

---

## Future Roadmap: Advanced Auth & RBAC
1. **Granular Permissions (Custom Roles)**: Instead of rigid enums, allow Tenant Admins to create custom roles (e.g., "Cashier") with specific boolean toggles (Can create invoice, Can delete items, Can view reports).
2. **User Invite Email Flow**: Transition from UUID-based assignment to a magic link email invitation flow, allowing new workers to seamlessly join a tenant.
3. **Manager Approvals**: Enforce rule-based workflows (e.g., Worker needs a manager's PIN/Approval to issue a discount over 10% or delete a critical invoice).
4. **Tenant MFA Enforcement**: Allow Tenant Admins to mandate that all workers enable Two-Factor Authentication (2FA) via Supabase.
5. **Super Admin Impersonation Mode**: Allow Super Admins to instantly "Login As" a specific tenant to debug issues and see exactly what the user sees.
6. **API Key Management**: Allow tenants to generate scoped API keys for external POS or E-commerce integrations.

