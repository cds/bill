// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateType, type CommonPowerSyncDatabase } from '@powersync/web';
import {
  retryOfflineInvoice,
  saveInvoiceLocally,
  type NewOfflineInvoice,
} from '@/lib/powersync/invoice-writes';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';

const INVOICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = 'tenant-123';
const SERVER_INVOICE_ID = 'server-invoice-123';
const invoice: NewOfflineInvoice = {
  invoice_date: '2026-11-09',
  party_id: 'party-123',
  party_name: 'Acme',
  payment_type: 'cash',
  payment_method: 'cash',
  amount_paid: 100,
  notes: null,
  items: [{
    item_id: 'item-123',
    item_name: 'Widget',
    quantity: 1,
    unit: 'pcs',
    rate: 100,
    tax_percent: 0,
    discount_percent: 0,
  }],
  estimated_total: 100,
};

function makeDatabase(options?: {
  crud?: Array<{
    id: string;
    table: string;
    op: UpdateType;
    opData?: Record<string, unknown>;
  }>;
}) {
  const complete = vi.fn().mockResolvedValue(undefined);
  const execute = vi.fn().mockResolvedValue(undefined);
  const database = {
    getCrudBatch: vi.fn().mockResolvedValue(
      options ? { crud: options.crud ?? [], complete } : null,
    ),
    execute,
    writeTransaction: vi.fn(async (
      callback: (transaction: { execute: typeof execute }) => Promise<unknown>,
    ) => callback({ execute })),
  } as unknown as CommonPowerSyncDatabase;

  return { database, complete, execute };
}

function makeInvoiceCrud() {
  return {
    id: INVOICE_ID,
    table: 'offline_invoices',
    op: UpdateType.PUT,
    opData: {
      tenant_id: TENANT_ID,
      ...invoice,
      items: JSON.stringify(invoice.items),
    },
  };
}

describe('PowerSync offline invoices', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves an invoice and pending status locally under a stable UUID', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => INVOICE_ID });
    const { database, execute } = makeDatabase();

    await expect(saveInvoiceLocally(database, TENANT_ID, invoice)).resolves.toBe(INVOICE_ID);

    expect(database.writeTransaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0]).toContain('INSERT INTO offline_invoices');
    expect(execute.mock.calls[0][1]).toEqual([
      INVOICE_ID,
      TENANT_ID,
      invoice.invoice_date,
      invoice.party_id,
      invoice.party_name,
      invoice.payment_type,
      invoice.payment_method,
      invoice.amount_paid,
      invoice.notes,
      JSON.stringify(invoice.items),
      invoice.estimated_total,
      expect.any(String),
    ]);
    expect(execute.mock.calls[1][0]).toContain("VALUES (?, ?, 'pending'");
  });

  it('uploads through the server and stores the official invoice number after acceptance', async () => {
    const { database, complete, execute } = makeDatabase({ crud: [makeInvoiceCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      id: SERVER_INVOICE_ID,
      invoice_number: 84,
    }, { status: 201 })));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(fetch).toHaveBeenCalledWith('/api/offline/invoices', expect.objectContaining({
      method: 'POST',
      redirect: 'manual',
      body: JSON.stringify({
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        invoice_date: invoice.invoice_date,
        party_id: invoice.party_id,
        party_name: invoice.party_name,
        payment_type: invoice.payment_type,
        payment_method: invoice.payment_method,
        amount_paid: invoice.amount_paid,
        notes: invoice.notes,
        items: invoice.items,
      }),
    }));
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('server_invoice_id = ?, server_invoice_number = ?'),
      ['synced', null, SERVER_INVOICE_ID, 84, expect.any(String), INVOICE_ID, TENANT_ID],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('retries with the same local UUID and payload so the server returns the original invoice', async () => {
    const { database, complete } = makeDatabase({ crud: [makeInvoiceCrud()] });
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: SERVER_INVOICE_ID, invoice_number: 84 }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ id: SERVER_INVOICE_ID, invoice_number: 84 }, { status: 201 }));
    vi.stubGlobal('fetch', request);
    const connector = new SupabasePowerSyncConnector();

    await connector.uploadData(database);
    await connector.uploadData(database);

    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(
      JSON.parse(request.mock.calls[1][1].body),
    );
    expect(JSON.parse(request.mock.calls[0][1].body).id).toBe(INVOICE_ID);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('retries safely when the server accepted an upload but its response was lost', async () => {
    const { database, complete } = makeDatabase({ crud: [makeInvoiceCrud()] });
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError('connection closed before response'))
      .mockResolvedValueOnce(Response.json({ id: SERVER_INVOICE_ID, invoice_number: 84 }, { status: 200 }));
    vi.stubGlobal('fetch', request);
    const connector = new SupabasePowerSyncConnector();

    await expect(connector.uploadData(database)).rejects.toThrow('connection closed');
    expect(complete).not.toHaveBeenCalled();

    await connector.uploadData(database);

    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(
      JSON.parse(request.mock.calls[1][1].body),
    );
    expect(JSON.parse(request.mock.calls[1][1].body).id).toBe(INVOICE_ID);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('records permanent server rejection with a recovery message', async () => {
    const { database, complete, execute } = makeDatabase({ crud: [makeInvoiceCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      error: 'Insufficient server stock; cached stock is only an estimate.',
    }, { status: 400 })));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('SET status = ?, error = ?, server_invoice_id = ?'),
      [
        'rejected',
        'Insufficient server stock; cached stock is only an estimate.',
        null,
        null,
        expect.any(String),
        INVOICE_ID,
        TENANT_ID,
      ],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('keeps revoked-membership rejection visible instead of retrying it forever', async () => {
    const { database, complete, execute } = makeDatabase({ crud: [makeInvoiceCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      error: 'Current user is not a member of this tenant',
    }, { status: 403 })));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('SET status = ?, error = ?, server_invoice_id = ?'),
      [
        'rejected',
        'Current user is not a member of this tenant',
        null,
        null,
        expect.any(String),
        INVOICE_ID,
        TENANT_ID,
      ],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('leaves temporary server failures queued for retry', async () => {
    const { database, complete } = makeDatabase({ crud: [makeInvoiceCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(new SupabasePowerSyncConnector().uploadData(database))
      .rejects.toThrow('PowerSync will retry');
    expect(complete).not.toHaveBeenCalled();
  });

  it('provides a user-triggered retry path for rejected invoices', async () => {
    const { database, execute } = makeDatabase();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      id: SERVER_INVOICE_ID,
      invoice_number: 84,
    }, { status: 200 })));

    await expect(retryOfflineInvoice(database, {
      id: INVOICE_ID,
      tenant_id: TENANT_ID,
      ...invoice,
      created_at: '2026-11-09T10:00:00.000Z',
      items: JSON.stringify(invoice.items),
    })).resolves.toBe('synced');

    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).id).toBe(INVOICE_ID);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('server_invoice_id = ?, server_invoice_number = ?'),
      ['synced', null, SERVER_INVOICE_ID, 84, expect.any(String), INVOICE_ID, TENANT_ID],
    );
  });
});
