'use client';

import type { CommonPowerSyncDatabase } from '@powersync/web';

export type NewOfflineItem = {
  name: string;
  unit: string;
  sale_price: number;
  purchase_price: number;
  opening_stock: number;
  low_stock_threshold?: number | null;
  hsn_code?: string | null;
};

export type OfflineItemStatus = 'pending' | 'synced' | 'rejected';

export async function saveItemLocally(
  database: CommonPowerSyncDatabase,
  tenantId: string,
  item: NewOfflineItem,
) {
  if (!tenantId.trim()) {
    throw new Error('A tenant ID is required to save an offline product.');
  }
  if (!item.name.trim()) {
    throw new Error('Product name is required.');
  }
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('This browser does not support secure UUID generation for offline records.');
  }

  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();
  const openingStock = Number(item.opening_stock) || 0;

  await database.writeTransaction(async (transaction) => {
    // 1. Queue into offline_items for upload to server
    await transaction.execute(
      `INSERT INTO offline_items
        (id, tenant_id, name, unit, sale_price, purchase_price, opening_stock, current_stock,
         low_stock_threshold, hsn_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        item.name.trim(),
        item.unit.trim() || 'Pcs',
        Number(item.sale_price) || 0,
        Number(item.purchase_price) || 0,
        openingStock,
        openingStock,
        item.low_stock_threshold !== undefined && item.low_stock_threshold !== null
          ? Number(item.low_stock_threshold)
          : null,
        item.hsn_code?.trim() || null,
        now,
      ],
    );

    // 2. Insert into item_sync_status to track local sync lifecycle
    await transaction.execute(
      `INSERT INTO item_sync_status
        (id, tenant_id, status, error, server_item_id, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?)`,
      [id, tenantId, 'pending', now],
    );

    // 3. Insert into local items table so it is immediately searchable and usable in sales
    await transaction.execute(
      `INSERT OR REPLACE INTO items
        (id, tenant_id, name, unit, sale_price, purchase_price, opening_stock, current_stock,
         low_stock_threshold, hsn_code, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        tenantId,
        item.name.trim(),
        item.unit.trim() || 'Pcs',
        Number(item.sale_price) || 0,
        Number(item.purchase_price) || 0,
        openingStock,
        openingStock,
        item.low_stock_threshold !== undefined && item.low_stock_threshold !== null
          ? Number(item.low_stock_threshold)
          : null,
        item.hsn_code?.trim() || null,
        now,
        now,
      ],
    );
  });

  return id;
}

export async function setItemSyncStatus(
  database: CommonPowerSyncDatabase,
  itemId: string,
  tenantId: string | null,
  status: OfflineItemStatus,
  error: string | null,
  serverItemId: string | null = null,
) {
  const query = `UPDATE item_sync_status
                 SET status = ?, error = ?, server_item_id = ?, updated_at = ?
                 WHERE id = ?`;
  const args = [
    status,
    error,
    serverItemId,
    new Date().toISOString(),
    itemId,
  ];
  if (tenantId) {
    await database.execute(`${query} AND tenant_id = ?`, [...args, tenantId]);
    return;
  }
  await database.execute(query, args);
}
