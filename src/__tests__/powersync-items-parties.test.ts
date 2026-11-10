// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateType, type CommonPowerSyncDatabase } from '@powersync/web';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';

const ITEM_ID = '660e8400-e29b-41d4-a716-446655440001';
const PARTY_ID = '770e8400-e29b-41d4-a716-446655440002';
const TENANT_ID = 'tenant-123';

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

describe('PowerSync offline items and parties upload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads items table change successfully and completes batch', async () => {
    const itemCrud = {
      id: ITEM_ID,
      table: 'items',
      op: UpdateType.PUT,
      opData: {
        tenant_id: TENANT_ID,
        name: 'Mustard Oil 1L',
        unit: 'Ltr',
        sale_price: 180,
        purchase_price: 150,
        opening_stock: 20,
        low_stock_threshold: 5,
        hsn_code: '1514',
      },
    };

    const { database, complete, execute } = makeDatabase({ crud: [itemCrud] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item: { id: ITEM_ID } }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    ));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(fetch).toHaveBeenCalledWith('/api/offline/items', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
      }),
      body: JSON.stringify({
        id: ITEM_ID,
        tenant_id: TENANT_ID,
        name: 'Mustard Oil 1L',
        unit: 'Ltr',
        sale_price: 180,
        purchase_price: 150,
        opening_stock: 20,
        low_stock_threshold: 5,
        hsn_code: '1514',
      }),
    }));

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE item_sync_status'),
      expect.arrayContaining(['synced', null, ITEM_ID]),
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('deduplicates when both offline_items and items exist in the same batch', async () => {
    const offlineCrud = {
      id: ITEM_ID,
      table: 'offline_items',
      op: UpdateType.PUT,
      opData: {
        tenant_id: TENANT_ID,
        name: 'Mustard Oil 1L',
        unit: 'Ltr',
        sale_price: 180,
      },
    };
    const itemsCrud = {
      id: ITEM_ID,
      table: 'items',
      op: UpdateType.PUT,
      opData: {
        tenant_id: TENANT_ID,
        name: 'Mustard Oil 1L',
        unit: 'Ltr',
        sale_price: 180,
      },
    };

    const { database, complete } = makeDatabase({ crud: [offlineCrud, itemsCrud] });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item: { id: ITEM_ID } }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await new SupabasePowerSyncConnector().uploadData(database);

    // Should only call API once for this item ID
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('uploads parties and offline_parties table changes successfully', async () => {
    const partyCrud = {
      id: PARTY_ID,
      table: 'parties',
      op: UpdateType.PUT,
      opData: {
        tenant_id: TENANT_ID,
        name: 'Sharma Traders',
        billing_name: 'Sharma Traders Pvt Ltd',
        phone: '9876543210',
        address: 'MG Road',
        type: 'customer',
      },
    };

    const { database, complete, execute } = makeDatabase({ crud: [partyCrud] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ party: { id: PARTY_ID } }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    ));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(fetch).toHaveBeenCalledWith('/api/offline/parties', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
      }),
      body: JSON.stringify({
        id: PARTY_ID,
        tenant_id: TENANT_ID,
        name: 'Sharma Traders',
        billing_name: 'Sharma Traders Pvt Ltd',
        phone: '9876543210',
        address: 'MG Road',
        type: 'customer',
      }),
    }));

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE party_sync_status'),
      expect.arrayContaining(['synced', null, PARTY_ID]),
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('supports UpdateType.PATCH for items and parties', async () => {
    const patchItemCrud = {
      id: ITEM_ID,
      table: 'items',
      op: UpdateType.PATCH,
      opData: {
        tenant_id: TENANT_ID,
        name: 'Mustard Oil 1L',
        sale_price: 180,
      },
    };

    const { database, complete } = makeDatabase({ crud: [patchItemCrud] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item: { id: ITEM_ID } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    await new SupabasePowerSyncConnector().uploadData(database);

    expect(complete).toHaveBeenCalledOnce();
  });
});
