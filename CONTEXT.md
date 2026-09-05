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
| **V4**: Auth, Multi-Tenancy & Deploy | Supabase Auth, RLS, Business profile, Vercel deployment | ⬜ Not started |

---

## V1, V2, V3 — What's Been Done ✅

### Project Scaffolding ✅
- Next.js 16.3.4 project initialized with App Router + TypeScript + Tailwind v4
- shadcn/ui initialized with 20 components installed (button, card, input, label, select, dialog, sheet, table, badge, tabs, separator, dropdown-menu, textarea, toggle-group, skeleton, alert, command, popover, calendar, toggle, input-group)
- Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `date-fns`, `lucide-react`, `sonner`
- Brand primary color set to green (oklch)

### Database ✅
- [supabase/migrations/001_initial_schema.sql](file:///Users/cs/Documents/bill/supabase/migrations/001_initial_schema.sql) — Full schema: `items`, `parties`, `invoices`, `invoice_items`, `stock_adjustments`, `expenses`
- [supabase/migrations/002_phase2_updates.sql](file:///Users/cs/Documents/bill/supabase/migrations/002_phase2_updates.sql) — Added `date` to `stock_adjustments`
- [supabase/seed.sql](file:///Users/cs/Documents/bill/supabase/seed.sql) — 10 food items, 5 customers, 3 suppliers

### Supabase Client Library ✅
- [src/lib/supabase/client.ts](file:///Users/cs/Documents/bill/src/lib/supabase/client.ts) — Browser client (`createBrowserClient`)
- [src/lib/supabase/server.ts](file:///Users/cs/Documents/bill/src/lib/supabase/server.ts) — Server client with async `cookies()`
- [src/lib/supabase/types.ts](file:///Users/cs/Documents/bill/src/lib/supabase/types.ts) — All TypeScript types (Item, Party, Invoice, etc.)
- [src/lib/utils.ts](file:///Users/cs/Documents/bill/src/lib/utils.ts) — `cn()`, `formatCurrency()` (INR), `formatDate()`, `toDateInputValue()`, `tempId()`

### Layout & Navigation ✅
- [src/app/layout.tsx](file:///Users/cs/Documents/bill/src/app/layout.tsx) — Root layout with Inter font, AppHeader, BottomNav, Toaster
- [src/app/globals.css](file:///Users/cs/Documents/bill/src/app/globals.css) — shadcn/ui theme with green primary, PDF Print styles
- [src/components/layout/bottom-nav.tsx](file:///Users/cs/Documents/bill/src/components/layout/bottom-nav.tsx) — Mobile bottom nav (Dashboard, Items, Sale, Sales, Parties, Expenses)
- [src/components/layout/app-header.tsx](file:///Users/cs/Documents/bill/src/components/layout/app-header.tsx) — Desktop nav header with Eatera Foods branding

### Shared Components ✅
- [page-header.tsx](file:///Users/cs/Documents/bill/src/components/shared/page-header.tsx), [empty-state.tsx](file:///Users/cs/Documents/bill/src/components/shared/empty-state.tsx), [currency.tsx](file:///Users/cs/Documents/bill/src/components/shared/currency.tsx), [stat-card.tsx](file:///Users/cs/Documents/bill/src/components/shared/stat-card.tsx)
- [print-button.tsx](file:///Users/cs/Documents/bill/src/components/shared/print-button.tsx) — Trigger `window.print()`

### Dashboard (Phase 2) ✅
- [src/app/page.tsx](file:///Users/cs/Documents/bill/src/app/page.tsx) — Quick actions, real-time stat cards (You'll Get, You'll Give, Monthly Sales, Cash-in-Hand, Stock Value, Low Stock Items), Recent Transactions list with Paid/Partial/Unpaid badges.

### Expense Tracker (Phase 2) ✅
- [src/app/expenses/page.tsx](file:///Users/cs/Documents/bill/src/app/expenses/page.tsx) — Expenses list view with real-time totals
- [src/components/expenses/expense-form.tsx](file:///Users/cs/Documents/bill/src/components/expenses/expense-form.tsx) — Modal to add/edit expenses (preset categories)
- [src/app/api/expenses/route.ts](file:///Users/cs/Documents/bill/src/app/api/expenses/route.ts) — GET/POST handlers

### Items & Stock Ledger (Phase 2) ✅
- [src/app/items/page.tsx](file:///Users/cs/Documents/bill/src/app/items/page.tsx) — Server component, fetches items
- [src/components/items/items-page-client.tsx](file:///Users/cs/Documents/bill/src/components/items/items-page-client.tsx) — Client wrapper with search + add dialog
- [src/app/items/[id]/page.tsx](file:///Users/cs/Documents/bill/src/app/items/%5Bid%5D/page.tsx) — Item detail with specs and Stock Ledger history
- [src/components/items/stock-adjustment-modal.tsx](file:///Users/cs/Documents/bill/src/components/items/stock-adjustment-modal.tsx) — Add/Reduce stock form
- [src/app/api/items/[id]/adjust/route.ts](file:///Users/cs/Documents/bill/src/app/api/items/%5Bid%5D/adjust/route.ts) — POST handler to record adjustment and update current stock
- [src/app/api/items/route.ts](file:///Users/cs/Documents/bill/src/app/api/items/route.ts) — GET/POST with opening stock
- [src/app/api/items/[id]/route.ts](file:///Users/cs/Documents/bill/src/app/api/items/%5Bid%5D/route.ts) — GET/PATCH/DELETE

### Parties Module ✅
- [src/app/parties/page.tsx](file:///Users/cs/Documents/bill/src/app/parties/page.tsx) — Server component
- [src/app/parties/parties-page-client.tsx](file:///Users/cs/Documents/bill/src/app/parties/parties-page-client.tsx) — Client with Tabs (Customers/Suppliers), search
- [src/app/parties/[id]/page.tsx](file:///Users/cs/Documents/bill/src/app/parties/%5Bid%5D/page.tsx) — Party detail with invoices
- [src/components/parties/party-form.tsx](file:///Users/cs/Documents/bill/src/components/parties/party-form.tsx) — Add/Edit dialog
- [src/components/parties/party-search.tsx](file:///Users/cs/Documents/bill/src/components/parties/party-search.tsx) — Searchable selector with Quick Add (used in invoice form)
- [src/app/api/parties/route.ts](file:///Users/cs/Documents/bill/src/app/api/parties/route.ts) — GET/POST with type filter
- [src/app/api/parties/[id]/route.ts](file:///Users/cs/Documents/bill/src/app/api/parties/%5Bid%5D/route.ts) — GET/PATCH/DELETE (checks invoices before delete)

### Sales / Invoice Module ✅
- [src/app/sales/page.tsx](file:///Users/cs/Documents/bill/src/app/sales/page.tsx) — Sales listing
- [src/app/sales/new/page.tsx](file:///Users/cs/Documents/bill/src/app/sales/new/page.tsx) — Renders InvoiceForm
- [src/app/sales/[id]/page.tsx](file:///Users/cs/Documents/bill/src/app/sales/%5Bid%5D/page.tsx) — Receipt-style invoice detail with print & WhatsApp sharing
- [src/components/sales/invoice-form.tsx](file:///Users/cs/Documents/bill/src/components/sales/invoice-form.tsx) — Full form with useReducer (date, time, payment mode, party search, line items, totals, Save & New / Save)
- [src/components/sales/line-item-row.tsx](file:///Users/cs/Documents/bill/src/components/sales/line-item-row.tsx) — Editable line item (qty, rate, tax%, disc%)
- [src/components/sales/item-selector.tsx](file:///Users/cs/Documents/bill/src/components/sales/item-selector.tsx) — Item search/select dialog
- [src/app/api/invoices/route.ts](file:///Users/cs/Documents/bill/src/app/api/invoices/route.ts) — GET/POST with server-side total calc, stock deduction, stock adjustments, party balance update
- [src/app/api/invoices/[id]/route.ts](file:///Users/cs/Documents/bill/src/app/api/invoices/%5Bid%5D/route.ts) — GET/DELETE with stock reversal

### Reports & PDF/Print Engine (Phase 3) ✅
- **Modular Reports**
  - [src/app/reports/page.tsx](file:///Users/cs/Documents/bill/src/app/reports/page.tsx) — Main reports directory
  - [src/app/reports/sales/page.tsx](file:///Users/cs/Documents/bill/src/app/reports/sales/page.tsx) — Sales Report with Date Range Filter
  - [src/app/reports/expenses/page.tsx](file:///Users/cs/Documents/bill/src/app/reports/expenses/page.tsx) — Expense Report with Date Range Filter
  - [src/app/reports/stock/page.tsx](file:///Users/cs/Documents/bill/src/app/reports/stock/page.tsx) — Stock Detail Report (dynamic opening stock, in, out, closing)
  - [src/app/reports/parties/page.tsx](file:///Users/cs/Documents/bill/src/app/reports/parties/page.tsx) — Party Statement ledger with Opening Balance
- **PDF/Print Infrastructure**
  - Implemented via `@media print` Tailwind classes (`print:hidden`, `print:border-none`, etc.) across the app shell and components to generate perfect A4 PDFs natively via browser.
- **WhatsApp Sharing**
  - Implemented formatted WhatsApp plaintext generation via `https://wa.me/?text=...` on `InvoiceDetail` and `PartyStatement`.

### Bug Fixes Applied ✅
- **Phase 2 Specs**: Replaced Base-UI incompatibilities (ToggleGroup type string, Select string|null errors)
- TypeScript errors fixed across components involving `asChild`, `formatDate(Date)`, and `PopoverTrigger`
- Fixed invoice API column names: `total_tax`→`tax_amount`, `total_discount`→`discount_amount`, `grand_total`→`total_amount`
- Added server-side total recalculation in invoice POST (don't trust client)
- **Phase 1 Spec Alignment**: 
  - Added `payment_method` to invoices DB, API, Types, and UI form (Cash, UPI, Bank)
  - Added `billing_name` to parties DB schema and Types
  - Added `invoice_time` field to the New Sale UI

---

## What's NOT Done Yet ⬜

### Immediate
1. **Supabase setup** — User needs to create a Supabase project, run the migration SQLs (`001_initial_schema.sql` and `002_phase2_updates.sql`), run the seed SQL, and add credentials to `.env.local`
2. **Manual verification** — Test all CRUD flows in browser with database connected

### V4: Auth, Multi-Tenancy & Deploy
- Next.js Auth / Supabase Auth integration
- Row Level Security (RLS) policies for multi-tenancy
- Business profile settings (Logo, address for invoices)
- Vercel deployment

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
    │   ├── globals.css         # Tailwind v4 + shadcn theme (green primary)
    │   ├── items/              # Item catalog pages
    │   ├── parties/            # Party management pages
    │   ├── sales/              # Invoice pages (list, new, detail)
    │   └── api/                # REST route handlers
    │       ├── items/
    │       ├── parties/
    │       └── invoices/
    ├── components/
    │   ├── ui/                 # 20 shadcn/ui components
    │   ├── layout/             # AppHeader, BottomNav
    │   ├── items/              # ItemCard, ItemForm, ItemsPageClient, ItemDetailClient
    │   ├── parties/            # PartyForm, PartySearch
    │   ├── sales/              # InvoiceForm, LineItemRow, ItemSelector
    │   └── shared/             # PageHeader, EmptyState, Currency, StatCard
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

