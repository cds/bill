'use client';

import { usePowerSync, useStatus } from '@powersync/react';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';

function subscribeToNetwork(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getNetworkStatus() {
  return navigator.onLine;
}

export function OfflineSyncStatus() {
  const database = usePowerSync();
  const status = useStatus();
  const isOnline = useSyncExternalStore(subscribeToNetwork, getNetworkStatus, () => false);
  const [isRequestingSync, setIsRequestingSync] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const isSyncing = status.connecting || status.downloading || status.uploading;
  const hasSynced = status.hasSynced === true;
  const label = !isOnline
    ? hasSynced
      ? 'Offline · local data available'
      : 'Not synced to this device'
    : isSyncing
      ? status.uploading
        ? 'Uploading local changes…'
        : 'Syncing to this device…'
      : status.connected && hasSynced
        ? 'Synced to this device'
        : hasSynced
          ? 'Saved locally · sync connection unavailable'
          : 'Waiting for first sync';
  const syncError = requestError ??
    status.downloadError?.message ??
    status.uploadError?.message;

  async function syncNow() {
    setRequestError(null);
    setIsRequestingSync(true);
    try {
      // Ensure any existing connection is reset before starting a new sync
      // This avoids a stale connection that might keep isSyncing true.
      if (status.connected) {
        await database.disconnect();
      }
      await database.connect(new SupabasePowerSyncConnector());
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setRequestError(message);
      console.error('Could not start PowerSync synchronization:', cause);
    } finally {
      setIsRequestingSync(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div>
        <p
          role="status"
          aria-live="polite"
          className={`text-sm font-medium ${
            hasSynced
              ? 'text-green-700 dark:text-green-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {label}
        </p>
        {status.lastSyncedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Last successful sync: {status.lastSyncedAt.toLocaleString()}
          </p>
        ) : null}
        {syncError ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            Sync issue: {syncError}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!isOnline || (isSyncing && !syncError) || isRequestingSync}
        onClick={() => void syncNow()}
      >
        {isRequestingSync ? 'Starting sync…' : 'Sync now'}
      </Button>
      {!isOnline ? (
        <p className="w-full text-xs text-muted-foreground">
          Reconnect to sync local changes and download updates.
        </p>
      ) : null}
    </section>
  );
}
