import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { UpdateType, type PowerSyncBackendConnector } from '@powersync/web';
import { setExpenseSyncStatus } from './expense-writes';
import { setInvoiceSyncStatus, type NewOfflineInvoiceItem } from './invoice-writes';
import { setPartySyncStatus } from './party-writes';
import { setItemSyncStatus } from './item-writes';

const REFRESH_BUFFER_SECONDS = 60;

function getPowerSyncEndpoint() {
  const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_URL;
  if (!endpoint) {
    throw new Error('NEXT_PUBLIC_POWERSYNC_URL is required to connect PowerSync.');
  }
  return endpoint;
}

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Failed to retrieve the Supabase session: ${error.message}`);
    }

    const session = data.session;
    if (!session) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const shouldRefresh = !session.expires_at ||
      session.expires_at <= now + REFRESH_BUFFER_SECONDS;
    let credentialSession = session;

    if (shouldRefresh) {
      const { data: refreshedData, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError) {
        throw new Error(`Failed to refresh the Supabase session: ${refreshError.message}`);
      }

      if (!refreshedData.session) {
        throw new Error('The Supabase session expired and could not be refreshed.');
      }

      credentialSession = refreshedData.session;
    }

    if (!credentialSession.access_token || !credentialSession.expires_at) {
      throw new Error('The Supabase session is missing a valid access token or expiry.');
    }
    if (credentialSession.expires_at <= now) {
      throw new Error('The Supabase session token is expired.');
    }

    return {
      endpoint: getPowerSyncEndpoint(),
      token: credentialSession.access_token,
      expiresAt: new Date(credentialSession.expires_at * 1000),
    };
  }

  async uploadData(database: Parameters<PowerSyncBackendConnector['uploadData']>[0]) {
    const batch = await database.getCrudBatch();
    if (!batch) return;

    for (const change of batch.crud) {
      if (change.table === 'expenses') {
        await this.uploadExpense(database, change);
        continue;
      }
      if (change.table === 'offline_invoices') {
        await this.uploadInvoice(database, change);
        continue;
      }
      if (change.table === 'offline_parties') {
        await this.uploadParty(database, change);
        continue;
      }
      if (change.table === 'offline_items') {
        await this.uploadItem(database, change);
        continue;
      }
      throw new Error(`Unsupported PowerSync upload table: ${change.table}`);
    }

    await batch.complete();
  }

  private async uploadExpense(
    database: Parameters<PowerSyncBackendConnector['uploadData']>[0],
    change: NonNullable<Awaited<ReturnType<typeof database.getCrudBatch>>>['crud'][number],
  ) {
    const tenantId = change.opData?.tenant_id;
    if (change.op !== UpdateType.PUT || typeof tenantId !== 'string' || !tenantId) {
      await setExpenseSyncStatus(
        database,
        change.id,
        typeof tenantId === 'string' ? tenantId : null,
        'rejected',
        'Only new expenses with a tenant ID can be synced.',
      );
      return;
    }

    const expenseData = change.opData;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        'Expense remains saved on this device. Sync will retry when the connection returns.',
      );
    }

    let response: Response;
    try {
      response = await fetch('/api/offline/expenses', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: change.id,
          tenant_id: tenantId,
          date: expenseData?.date,
          category: expenseData?.category,
          amount: Number(expenseData?.amount),
          payment_mode: expenseData?.payment_mode,
          notes: expenseData?.notes ?? null,
        }),
      });
    } catch (cause: unknown) {
      if (cause instanceof TypeError) {
        throw new Error(
          'Expense remains saved on this device. Sync will retry when the connection returns.',
          { cause },
        );
      }
      throw cause;
    }

    if (response.ok) {
      await setExpenseSyncStatus(database, change.id, tenantId, 'synced', null);
      return;
    }

    if (this.isTemporaryFailure(response.status)) {
      throw new Error(`Temporary expense sync failure (${response.status}); PowerSync will retry.`);
    }

    const responseBody = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof responseBody?.error === 'string'
      ? responseBody.error
      : `Expense rejected by server (${response.status}).`;
    await setExpenseSyncStatus(database, change.id, tenantId, 'rejected', message);
  }

  private async uploadInvoice(
    database: Parameters<PowerSyncBackendConnector['uploadData']>[0],
    change: NonNullable<Awaited<ReturnType<typeof database.getCrudBatch>>>['crud'][number],
  ) {
    const tenantId = change.opData?.tenant_id;
    if (change.op !== UpdateType.PUT || typeof tenantId !== 'string' || !tenantId) {
      await setInvoiceSyncStatus(
        database,
        change.id,
        typeof tenantId === 'string' ? tenantId : null,
        'rejected',
        'Only new invoices with a tenant ID can be synced.',
      );
      return;
    }

    const data = change.opData;
    let items: NewOfflineInvoiceItem[];
    try {
      const parsed: unknown = typeof data?.items === 'string'
        ? JSON.parse(data.items)
        : data?.items;
      if (!Array.isArray(parsed)) throw new Error('Invoice lines must be an array.');
      items = parsed as NewOfflineInvoiceItem[];
    } catch {
      await setInvoiceSyncStatus(
        database,
        change.id,
        tenantId,
        'rejected',
        'The saved invoice lines could not be read. Create a corrected new invoice.',
      );
      return;
    }

    const response = await fetch('/api/offline/invoices', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: change.id,
        tenant_id: tenantId,
        invoice_date: data?.invoice_date,
        party_id: data?.party_id ?? null,
        party_name: data?.party_name,
        payment_type: data?.payment_type,
        payment_method: data?.payment_method,
        amount_paid: Number(data?.amount_paid),
        notes: data?.notes ?? null,
        items,
      }),
    });

    if (response.ok) {
      const responseBody = await response.json().catch(() => null) as {
        id?: unknown;
        invoice_number?: unknown;
      } | null;
      if (
        typeof responseBody?.id !== 'string' ||
        typeof responseBody.invoice_number !== 'number' ||
        !Number.isInteger(responseBody.invoice_number)
      ) {
        throw new Error('The server response did not contain an official invoice number; PowerSync will retry.');
      }
      await setInvoiceSyncStatus(
        database,
        change.id,
        tenantId,
        'synced',
        null,
        responseBody.id,
        responseBody.invoice_number,
      );
      return;
    }

    if (this.isTemporaryFailure(response.status)) {
      throw new Error(`Temporary invoice sync failure (${response.status}); PowerSync will retry.`);
    }

    const responseBody = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof responseBody?.error === 'string'
      ? responseBody.error
      : `Invoice rejected by server (${response.status}).`;
    await setInvoiceSyncStatus(database, change.id, tenantId, 'rejected', message);
  }

  private async uploadParty(
    database: Parameters<PowerSyncBackendConnector['uploadData']>[0],
    change: NonNullable<Awaited<ReturnType<typeof database.getCrudBatch>>>['crud'][number],
  ) {
    const tenantId = change.opData?.tenant_id;
    if (change.op !== UpdateType.PUT || typeof tenantId !== 'string' || !tenantId) {
      await setPartySyncStatus(
        database,
        change.id,
        typeof tenantId === 'string' ? tenantId : null,
        'rejected',
        'Only new parties with a tenant ID can be synced.',
      );
      return;
    }

    const partyData = change.opData;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        'Party remains saved on this device. Sync will retry when the connection returns.',
      );
    }

    let response: Response;
    try {
      response = await fetch('/api/offline/parties', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: change.id,
          tenant_id: tenantId,
          name: partyData?.name,
          billing_name: partyData?.billing_name ?? null,
          phone: partyData?.phone ?? null,
          address: partyData?.address ?? null,
          type: partyData?.type || 'customer',
        }),
      });
    } catch (cause: unknown) {
      if (cause instanceof TypeError) {
        throw new Error(
          'Party remains saved on this device. Sync will retry when the connection returns.',
          { cause },
        );
      }
      throw cause;
    }

    if (response.ok) {
      const responseBody = await response.json().catch(() => null) as { party?: { id?: unknown } } | null;
      await setPartySyncStatus(
        database,
        change.id,
        tenantId,
        'synced',
        null,
        typeof responseBody?.party?.id === 'string' ? responseBody.party.id : change.id,
      );
      return;
    }

    if (this.isTemporaryFailure(response.status)) {
      throw new Error(`Temporary party sync failure (${response.status}); PowerSync will retry.`);
    }

    const responseBody = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof responseBody?.error === 'string'
      ? responseBody.error
      : `Party rejected by server (${response.status}).`;
    await setPartySyncStatus(database, change.id, tenantId, 'rejected', message);
  }

  private async uploadItem(
    database: Parameters<PowerSyncBackendConnector['uploadData']>[0],
    change: NonNullable<Awaited<ReturnType<typeof database.getCrudBatch>>>['crud'][number],
  ) {
    const tenantId = change.opData?.tenant_id;
    if (change.op !== UpdateType.PUT || typeof tenantId !== 'string' || !tenantId) {
      await setItemSyncStatus(
        database,
        change.id,
        typeof tenantId === 'string' ? tenantId : null,
        'rejected',
        'Only new items with a tenant ID can be synced.',
      );
      return;
    }

    const itemData = change.opData;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        'Product remains saved on this device. Sync will retry when the connection returns.',
      );
    }

    let response: Response;
    try {
      response = await fetch('/api/offline/items', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: change.id,
          tenant_id: tenantId,
          name: itemData?.name,
          unit: itemData?.unit || 'Pcs',
          sale_price: Number(itemData?.sale_price) || 0,
          purchase_price: Number(itemData?.purchase_price) || 0,
          opening_stock: Number(itemData?.opening_stock) || 0,
          low_stock_threshold: itemData?.low_stock_threshold !== undefined && itemData?.low_stock_threshold !== null
            ? Number(itemData?.low_stock_threshold)
            : null,
          hsn_code: itemData?.hsn_code ?? null,
        }),
      });
    } catch (cause: unknown) {
      if (cause instanceof TypeError) {
        throw new Error(
          'Product remains saved on this device. Sync will retry when the connection returns.',
          { cause },
        );
      }
      throw cause;
    }

    if (response.ok) {
      const responseBody = await response.json().catch(() => null) as { item?: { id?: unknown } } | null;
      await setItemSyncStatus(
        database,
        change.id,
        tenantId,
        'synced',
        null,
        typeof responseBody?.item?.id === 'string' ? responseBody.item.id : change.id,
      );
      return;
    }

    if (this.isTemporaryFailure(response.status)) {
      throw new Error(`Temporary item sync failure (${response.status}); PowerSync will retry.`);
    }

    const responseBody = await response.json().catch(() => null) as { error?: unknown } | null;
    const message = typeof responseBody?.error === 'string'
      ? responseBody.error
      : `Product rejected by server (${response.status}).`;
    await setItemSyncStatus(database, change.id, tenantId, 'rejected', message);
  }

  private isTemporaryFailure(status: number) {
    return status === 0 ||
      (status >= 300 && status < 400) ||
      status >= 500 ||
      status === 408 ||
      status === 429;
  }
}
