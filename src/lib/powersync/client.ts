import 'client-only';

import {
  PowerSyncDatabase,
  WASQLiteVFS,
} from '@powersync/web';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { SupabasePowerSyncConnector } from './connector';
import { persistOfflineTenantSelection } from './offline-storage';
import { powerSyncSchema } from './schema';

const databases = new Map<string, Promise<PowerSyncDatabase>>();

export async function getPowerSyncDatabase(tenantId: string) {
  if (typeof window === 'undefined') {
    throw new Error('PowerSync can only be initialized in a browser.');
  }
  if (!tenantId.trim()) {
    throw new Error('A tenant ID is required to initialize PowerSync.');
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to retrieve the Supabase session: ${error.message}`);
  }
  const session = data.session;
  if (!session) {
    throw new Error('A signed-in Supabase session is required to initialize PowerSync.');
  }

  persistOfflineTenantSelection(session.user.id, tenantId);

  const databaseKey = `${session.user.id}:${tenantId}`;
  let databasePromise = databases.get(databaseKey);

  if (!databasePromise) {
    databasePromise = (async () => {
      if (!process.env.NEXT_PUBLIC_POWERSYNC_URL) {
        throw new Error('NEXT_PUBLIC_POWERSYNC_URL is required to connect PowerSync.');
      }
      const database = new PowerSyncDatabase({
        schema: powerSyncSchema,
        database: {
          dbFilename: `bill-${session.user.id}-${tenantId}.db`,
          vfs: WASQLiteVFS.IDBBatchAtomicVFS,
        },
      });

      // Initialize the local database first so it is usable even when
      // the remote sync connection fails (e.g. auth errors, offline).
      await database.init();

      // Start remote sync in the background — errors are surfaced via
      // the database's status listener, not by rejecting this promise.
      database.connect(new SupabasePowerSyncConnector()).catch((err) => {
        console.warn('[PowerSync] Background sync connection failed:', err);
      });

      return database;
    })();

    databases.set(databaseKey, databasePromise);
    void databasePromise.catch(() => databases.delete(databaseKey));
  }

  return databasePromise;
}
