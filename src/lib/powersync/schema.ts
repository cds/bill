import { column, Schema, Table } from '@powersync/web';

const items = new Table(
  {
    tenant_id: column.text,
    name: column.text,
    unit: column.text,
    sale_price: column.real,
    purchase_price: column.real,
    opening_stock: column.real,
    current_stock: column.real,
    low_stock_threshold: column.real,
    hsn_code: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    deleted_by: column.text,
    deleted_reason: column.text,
    change_reason: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const parties = new Table(
  {
    tenant_id: column.text,
    name: column.text,
    billing_name: column.text,
    phone: column.text,
    address: column.text,
    type: column.text,
    balance: column.real,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    deleted_by: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const expenses = Table.createInsertOnly(
  {
    tenant_id: column.text,
    date: column.text,
    category: column.text,
    amount: column.real,
    payment_status: column.text,
    payment_mode: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const expense_sync_status = Table.createLocalOnly(
  {
    tenant_id: column.text,
    date: column.text,
    category: column.text,
    amount: column.real,
    payment_status: column.text,
    payment_mode: column.text,
    notes: column.text,
    created_at: column.text,
    status: column.text,
    error: column.text,
    updated_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const offline_invoices = Table.createInsertOnly(
  {
    tenant_id: column.text,
    invoice_date: column.text,
    party_id: column.text,
    party_name: column.text,
    payment_type: column.text,
    payment_method: column.text,
    amount_paid: column.real,
    notes: column.text,
    items: column.text,
    estimated_total: column.real,
    created_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const invoice_sync_status = Table.createLocalOnly(
  {
    tenant_id: column.text,
    status: column.text,
    error: column.text,
    server_invoice_id: column.text,
    server_invoice_number: column.integer,
    updated_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

export const powerSyncSchema = new Schema({
  items,
  parties,
  expenses,
  expense_sync_status,
  offline_invoices,
  invoice_sync_status,
});
