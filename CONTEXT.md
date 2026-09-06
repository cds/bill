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
| **V4**: Auth, Multi-Tenancy & Deploy | Supabase Auth, RLS, Business profile, Vercel deployment | ✅ **Code complete** |

---

### V1, V2, V3, V4 — Completed Scope ✅

**1. Project & Database Structure:**
- Next.js 16.3.4 (App Router) + Tailwind v4 + shadcn/ui.
- Supabase PostgreSQL schema complete: `items`, `parties`, `invoices`, `invoice_items`, `stock_adjustments`, `expenses`.
- Server/Client Supabase utilities and TypeScript types implemented.

**2. Core Modules (Implemented & Verified):**
- **Dashboard (`/`)**: Real-time metrics (Sales, Receivables, Payables, Cash-in-Hand) and recent transactions.
- **Items (`/items`)**: Catalog, CRUD, Stock Ledger, manual stock adjustments.
- **Parties (`/parties`)**: Customers/Suppliers CRUD, ledger view, balances.
- **Sales (`/sales`)**: Full invoice creation workflow (items, taxes, discounts, cash/credit), stock auto-deduction, invoice list, receipt view.
- **Expenses (`/expenses`)**: Categorized expense tracking.
- **Reports (`/reports`)**: Date-filtered reports (Sales, Expenses, Stock Detail, Party Statement).
- **Multi-Tenancy**: Supabase Auth integration, isolated `business_id` spaces, Row Level Security (RLS) enforcement, Next.js Middleware route protection.
- **PDF & Sharing**: Native `@media print` layouts for A4/thermal printing, and WhatsApp Share integrations.

*All TypeScript errors and base-ui prop incompatibilities have been resolved. The app compiles cleanly.*

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

