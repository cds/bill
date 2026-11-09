import 'client-only';

import type { CommonPowerSyncDatabase } from '@powersync/web';

export type NewOfflineInvoiceItem = {
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_percent: number;
  discount_percent: number;
};

export type NewOfflineInvoice = {
  invoice_date: string;
  party_id: string | null;
  party_name: string;
  payment_type: 'cash' | 'credit';
  payment_method: 'cash' | 'upi' | 'bank';
  amount_paid: number;
  notes: string | null;
  items: NewOfflineInvoiceItem[];
  estimated_total: number;
};

export type OfflineInvoiceStatus = 'pending' | 'synced' | 'rejected';

export type OfflineInvoiceRow = Omit<NewOfflineInvoice, 'items'> & {
  id: string;
  tenant_id: string;
  items: NewOfflineInvoiceItem[] | string;
  created_at: string;
};

export type OfflineInvoiceStatusRow = {
  id: string;
  tenant_id: string;
  status: OfflineInvoiceStatus;
  error: string | null;
  server_invoice_id: string | null;
  server_invoice_number: number | null;
  updated_at: string;
};

export async function saveInvoiceLocally(
  database: CommonPowerSyncDatabase,
  tenantId: string,
  invoice: NewOfflineInvoice,
) {
  if (!tenantId.trim()) {
    throw new Error('A tenant ID is required to save an offline invoice.');
  }
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('This browser does not support secure UUID generation for offline invoices.');
  }

  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();
  await database.writeTransaction(async (transaction) => {
    await transaction.execute(
      `INSERT INTO offline_invoices
        (id, tenant_id, invoice_date, party_id, party_name, payment_type, payment_method,
         amount_paid, notes, items, estimated_total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        invoice.invoice_date,
        invoice.party_id,
        invoice.party_name,
        invoice.payment_type,
        invoice.payment_method,
        invoice.amount_paid,
        invoice.notes,
        JSON.stringify(invoice.items),
        invoice.estimated_total,
        now,
      ],
    );
    await transaction.execute(
      `INSERT INTO invoice_sync_status
        (id, tenant_id, status, error, server_invoice_id, server_invoice_number, updated_at)
       VALUES (?, ?, 'pending', NULL, NULL, NULL, ?)`,
      [id, tenantId, now],
    );
  });

  return id;
}

export async function setInvoiceSyncStatus(
  database: CommonPowerSyncDatabase,
  invoiceId: string,
  tenantId: string | null,
  status: OfflineInvoiceStatus,
  error: string | null,
  serverInvoiceId: string | null = null,
  serverInvoiceNumber: number | null = null,
) {
  const query = `UPDATE invoice_sync_status
                 SET status = ?, error = ?, server_invoice_id = ?, server_invoice_number = ?, updated_at = ?
                 WHERE id = ?`;
  const args = [
    status,
    error,
    serverInvoiceId,
    serverInvoiceNumber,
    new Date().toISOString(),
    invoiceId,
  ];
  if (tenantId) {
    await database.execute(`${query} AND tenant_id = ?`, [...args, tenantId]);
    return;
  }
  await database.execute(query, args);
}

export async function retryOfflineInvoice(
  database: CommonPowerSyncDatabase,
  invoice: OfflineInvoiceRow,
) {
  let items: NewOfflineInvoiceItem[];
  try {
    items = typeof invoice.items === 'string'
      ? JSON.parse(invoice.items) as NewOfflineInvoiceItem[]
      : invoice.items;
  } catch {
    await setInvoiceSyncStatus(
      database,
      invoice.id,
      invoice.tenant_id,
      'rejected',
      'The saved invoice lines could not be read. Create a corrected new invoice.',
    );
    return 'rejected' as const;
  }

  const response = await fetch('/api/offline/invoices', {
    method: 'POST',
    credentials: 'same-origin',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: invoice.id,
      tenant_id: invoice.tenant_id,
      invoice_date: invoice.invoice_date,
      party_id: invoice.party_id,
      party_name: invoice.party_name,
      payment_type: invoice.payment_type,
      payment_method: invoice.payment_method,
      amount_paid: invoice.amount_paid,
      notes: invoice.notes,
      items,
    }),
  });

  if (
    response.status === 0 ||
    (response.status >= 300 && response.status < 400) ||
    response.status >= 500 ||
    response.status === 408 ||
    response.status === 429
  ) {
    throw new Error(`Temporary invoice sync failure (${response.status}); try again when online.`);
  }

  const responseBody = await response.json().catch(() => null) as {
    error?: unknown;
    id?: unknown;
    invoice_number?: unknown;
  } | null;
  if (!response.ok) {
    const message = typeof responseBody?.error === 'string'
      ? responseBody.error
      : `Invoice rejected by server (${response.status}).`;
    await setInvoiceSyncStatus(database, invoice.id, invoice.tenant_id, 'rejected', message);
    return 'rejected' as const;
  }

  if (
    typeof responseBody?.id !== 'string' ||
    typeof responseBody.invoice_number !== 'number' ||
    !Number.isInteger(responseBody.invoice_number)
  ) {
    throw new Error('The server response did not contain an official invoice number; the upload can be retried safely.');
  }

  await setInvoiceSyncStatus(
    database,
    invoice.id,
    invoice.tenant_id,
    'synced',
    null,
    responseBody.id,
    responseBody.invoice_number,
  );
  return 'synced' as const;
}
