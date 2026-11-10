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

const invoices = new Table(
  {
    tenant_id: column.text,
    invoice_number: column.integer,
    invoice_date: column.text,
    party_id: column.text,
    party_name: column.text,
    payment_type: column.text,
    payment_method: column.text,
    subtotal: column.real,
    tax_amount: column.real,
    discount_amount: column.real,
    total_amount: column.real,
    amount_paid: column.real,
    balance_due: column.real,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    deleted_by: column.text,
    deleted_reason: column.text,
    change_reason: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'], by_date: ['tenant_id', 'invoice_date'] } },
);

const invoice_items = new Table(
  {
    tenant_id: column.text,
    invoice_id: column.text,
    item_id: column.text,
    item_name: column.text,
    quantity: column.real,
    unit: column.text,
    rate: column.real,
    tax_percent: column.real,
    tax_amount: column.real,
    discount_percent: column.real,
    discount_amount: column.real,
    amount: column.real,
    created_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { by_invoice: ['invoice_id'], by_tenant: ['tenant_id'] } },
);

const expenses = new Table(
  {
    tenant_id: column.text,
    date: column.text,
    category: column.text,
    amount: column.real,
    payment_status: column.text,
    payment_mode: column.text,
    notes: column.text,
    created_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'], by_date: ['tenant_id', 'date'] } },
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

const offline_parties = Table.createInsertOnly(
  {
    tenant_id: column.text,
    name: column.text,
    billing_name: column.text,
    phone: column.text,
    address: column.text,
    type: column.text,
    created_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const party_sync_status = Table.createLocalOnly(
  {
    tenant_id: column.text,
    status: column.text,
    error: column.text,
    server_party_id: column.text,
    updated_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const offline_items = Table.createInsertOnly(
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
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

const item_sync_status = Table.createLocalOnly(
  {
    tenant_id: column.text,
    status: column.text,
    error: column.text,
    server_item_id: column.text,
    updated_at: column.text,
  },
  { indexes: { by_tenant: ['tenant_id'] } },
);

export const powerSyncSchema = new Schema({
  items,
  parties,
  invoices,
  invoice_items,
  expenses,
  expense_sync_status,
  offline_invoices,
  invoice_sync_status,
  offline_parties,
  party_sync_status,
  offline_items,
  item_sync_status,
});
