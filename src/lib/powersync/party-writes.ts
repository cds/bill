'use client';

import type { CommonPowerSyncDatabase } from '@powersync/web';

export type NewOfflineParty = {
  name: string;
  billing_name?: string | null;
  phone?: string | null;
  address?: string | null;
  type: 'customer' | 'supplier';
};

export type OfflinePartyStatus = 'pending' | 'synced' | 'rejected';

export async function savePartyLocally(
  database: CommonPowerSyncDatabase,
  tenantId: string,
  party: NewOfflineParty,
) {
  if (!tenantId.trim()) {
    throw new Error('A tenant ID is required to save an offline party.');
  }
  if (!party.name.trim()) {
    throw new Error('Party name is required.');
  }
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('This browser does not support secure UUID generation for offline records.');
  }

  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();

  await database.writeTransaction(async (transaction) => {
    // 1. Queue into offline_parties for upload to server
    await transaction.execute(
      `INSERT INTO offline_parties
        (id, tenant_id, name, billing_name, phone, address, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        party.name.trim(),
        party.billing_name?.trim() || null,
        party.phone?.trim() || null,
        party.address?.trim() || null,
        party.type,
        now,
      ],
    );

    // 2. Insert into party_sync_status to track local sync lifecycle
    await transaction.execute(
      `INSERT INTO party_sync_status
        (id, tenant_id, status, error, server_party_id, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?)`,
      [id, tenantId, 'pending', now],
    );

    // 3. Insert into local parties table so it is immediately searchable and visible
    await transaction.execute(
      `INSERT OR REPLACE INTO parties
        (id, tenant_id, name, billing_name, phone, address, type, balance, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
      [
        id,
        tenantId,
        party.name.trim(),
        party.billing_name?.trim() || null,
        party.phone?.trim() || null,
        party.address?.trim() || null,
        party.type,
        now,
        now,
      ],
    );
  });

  return id;
}

export async function setPartySyncStatus(
  database: CommonPowerSyncDatabase,
  partyId: string,
  tenantId: string | null,
  status: OfflinePartyStatus,
  error: string | null,
  serverPartyId: string | null = null,
) {
  const query = `UPDATE party_sync_status
                 SET status = ?, error = ?, server_party_id = ?, updated_at = ?
                 WHERE id = ?`;
  const args = [
    status,
    error,
    serverPartyId,
    new Date().toISOString(),
    partyId,
  ];
  if (tenantId) {
    await database.execute(`${query} AND tenant_id = ?`, [...args, tenantId]);
    return;
  }
  await database.execute(query, args);
}
