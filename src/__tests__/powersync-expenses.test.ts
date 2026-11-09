// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateType, type CommonPowerSyncDatabase } from '@powersync/web';
import { saveExpenseLocally } from '@/lib/powersync/expense-writes';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';

const EXPENSE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = 'tenant-123';
const expenseData = {
  id: EXPENSE_ID,
  tenant_id: TENANT_ID,
  date: '2026-11-09',
  category: 'Fuel',
  amount: 125.5,
  payment_status: 'paid',
  payment_mode: 'cash',
  notes: 'Generator',
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
      options
        ? { crud: options.crud ?? [], complete }
        : null,
    ),
    execute,
    writeTransaction: vi.fn(async (callback: (transaction: { execute: typeof execute }) => Promise<unknown>) =>
      callback({ execute }),
    ),
  } as unknown as CommonPowerSyncDatabase;

  return { database, complete, execute };
}

function makeExpenseCrud() {
  return {
    id: EXPENSE_ID,
    table: 'expenses',
    op: UpdateType.PUT,
    opData: {
      tenant_id: TENANT_ID,
      date: expenseData.date,
      category: expenseData.category,
      amount: expenseData.amount,
      payment_status: expenseData.payment_status,
      payment_mode: expenseData.payment_mode,
      notes: expenseData.notes,
    },
  };
}

describe('PowerSync offline expenses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves an expense and pending status locally with a stable UUID', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => EXPENSE_ID });
    const { database, execute } = makeDatabase();

    await expect(saveExpenseLocally(database, TENANT_ID, {
      date: expenseData.date,
      category: expenseData.category,
      amount: expenseData.amount,
      payment_mode: 'cash',
      notes: expenseData.notes,
    })).resolves.toBe(EXPENSE_ID);

    expect(database.writeTransaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0]).toContain('INSERT INTO expenses');
    expect(execute.mock.calls[0][1]).toEqual([
      EXPENSE_ID,
      TENANT_ID,
      expenseData.date,
      expenseData.category,
      expenseData.amount,
      'cash',
      'Generator',
      expect.any(String),
    ]);
    expect(execute.mock.calls[1][0]).toContain("'pending'");
    expect(execute.mock.calls[1][1]).toEqual([
      EXPENSE_ID,
      TENANT_ID,
      expect.any(String),
    ]);
  });

  it('uploads successfully and marks the local expense synced', async () => {
    const { database, complete, execute } = makeDatabase({ crud: [makeExpenseCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 201 })));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(fetch).toHaveBeenCalledWith('/api/offline/expenses', expect.objectContaining({
      method: 'POST',
      redirect: 'manual',
      body: JSON.stringify({
        id: EXPENSE_ID,
        tenant_id: TENANT_ID,
        date: expenseData.date,
        category: expenseData.category,
        amount: expenseData.amount,
        payment_mode: expenseData.payment_mode,
        notes: expenseData.notes,
      }),
    }));
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("SET status = ?, error = ?, updated_at = ?"),
      ['synced', null, expect.any(String), EXPENSE_ID, TENANT_ID],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('retries a duplicate upload with the same stable ID without losing sync state', async () => {
    const { database, complete, execute } = makeDatabase({ crud: [makeExpenseCrud()] });
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', request);
    const connector = new SupabasePowerSyncConnector();

    await connector.uploadData(database);
    await connector.uploadData(database);

    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(
      JSON.parse(request.mock.calls[1][1].body),
    );
    expect(complete).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.every((call) => call[1]?.[0] === 'synced')).toBe(true);
  });

  it('retries safely when the server accepted an upload but its response was lost', async () => {
    const { database, complete } = makeDatabase({ crud: [makeExpenseCrud()] });
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError('connection closed before response'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', request);
    const connector = new SupabasePowerSyncConnector();

    await expect(connector.uploadData(database)).rejects.toThrow('connection closed');
    expect(complete).not.toHaveBeenCalled();

    await connector.uploadData(database);

    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(
      JSON.parse(request.mock.calls[1][1].body),
    );
    expect(JSON.parse(request.mock.calls[1][1].body).id).toBe(EXPENSE_ID);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('records a permanent server rejection and completes the batch', async () => {
    const { database, complete, execute } = makeDatabase({ crud: [makeExpenseCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      Response.json({ error: 'Current user is not a member of this tenant' }, { status: 403 }),
    ));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("SET status = ?, error = ?, updated_at = ?"),
      ['rejected', 'Current user is not a member of this tenant', expect.any(String), EXPENSE_ID, TENANT_ID],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('leaves temporary server failures in the upload queue for retry', async () => {
    const { database, complete } = makeDatabase({ crud: [makeExpenseCrud()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(new SupabasePowerSyncConnector().uploadData(database))
      .rejects.toThrow('PowerSync will retry');
    expect(complete).not.toHaveBeenCalled();
  });
});
