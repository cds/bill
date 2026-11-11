'use client';

import { usePowerSync, useStatus } from '@powersync/react';
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';
import { getSyncMode, setSyncMode, subscribeSyncMode, type SyncMode } from '@/lib/powersync/sync-mode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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

  // ── Sync mode (online / local) ─────────────────────────────────────
  const syncMode = useSyncExternalStore(subscribeSyncMode, getSyncMode, () => 'online');
  const [switching, setSwitching] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  // If initial saved mode is local, ensure database sync is disconnected
  useEffect(() => {
    if (syncMode === 'local' && status.connected) {
      void database.disconnect().catch(() => {});
    }
  }, [database, status.connected, syncMode]);

  // Count pending (unsynced) changes whenever upload state changes
  const refreshPending = useCallback(async () => {
    try {
      const batch = await database.getCrudBatch();
      setPendingChanges(batch ? batch.crud.length : 0);
    } catch {
      setPendingChanges(0);
    }
  }, [database]);

  useEffect(() => {
    void refreshPending();
  }, [status.uploading, status.hasSynced, refreshPending]);

  // ── Derived display values ─────────────────────────────────────────
  const isLocalMode = syncMode === 'local';
  const isSyncing = status.connecting || status.downloading || status.uploading;
  const hasSynced = status.hasSynced === true;

  const syncError = requestError ?? status.downloadError?.message ?? status.uploadError?.message;

  const statusLabel = isLocalMode
    ? '📱 Local-only mode · sync paused'
    : !isOnline
      ? hasSynced ? 'Offline · local data available' : 'Not synced to this device'
      : isSyncing
        ? status.uploading ? 'Uploading local changes…' : 'Syncing to this device…'
        : status.connected && hasSynced
          ? 'Synced to this device'
          : hasSynced
            ? 'Saved locally · sync connection unavailable'
            : 'Waiting for first sync';

  // ── Mode switch handlers ───────────────────────────────────────────
  async function handleToggleMode() {
    if (!isLocalMode) {
      // Online → Local: check for pending changes first
      if (pendingChanges > 0) {
        setShowConfirm(true);
        return;
      }
      await switchToLocal();
    } else {
      await switchToOnline();
    }
  }

  async function switchToLocal() {
    setSwitching(true);
    try {
      await database.disconnect();
    } catch (e) {
      console.warn('[PowerSync] Disconnect error (safe to ignore):', e);
    } finally {
      setSyncMode('local');
      setSwitching(false);
      setShowConfirm(false);
    }
  }

  async function switchToOnline() {
    setSwitching(true);
    try {
      setSyncMode('online');
      await database.connect(new SupabasePowerSyncConnector());
    } catch (e) {
      console.error('[PowerSync] Connect error:', e);
    } finally {
      setSwitching(false);
    }
  }

  // Sync pending changes then switch to local
  async function syncThenSwitchToLocal() {
    setSwitching(true);
    try {
      if (!status.connected) {
        await database.connect(new SupabasePowerSyncConnector());
      }
      // Wait up to 10 s for the queue to drain
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const batch = await database.getCrudBatch();
        if (!batch || batch.crud.length === 0) break;
        await new Promise<void>((r) => setTimeout(r, 500));
      }
      await switchToLocal();
    } finally {
      setSwitching(false);
      setShowConfirm(false);
    }
  }

  // ── Sync Now (upload) ──────────────────────────────────────────────
  async function syncNow() {
    setRequestError(null);
    setIsRequestingSync(true);
    try {
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

  // ── Dot colour for toggle ──────────────────────────────────────────
  let dotClass = 'bg-slate-400';
  if (!isLocalMode) {
    if (!isOnline) dotClass = 'bg-destructive';
    else if (isSyncing) dotClass = 'bg-amber-500 animate-pulse';
    else if (status.connected) dotClass = 'bg-green-500';
    else dotClass = 'bg-amber-500';
  }

  return (
    <>
      <section className="rounded-lg border p-4 space-y-3">
        {/* ── Top row: status text + toggle ─────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              role="status"
              aria-live="polite"
              className={`text-sm font-medium ${
                isLocalMode
                  ? 'text-slate-600 dark:text-slate-400'
                  : hasSynced
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {statusLabel}
            </p>
            {status.lastSyncedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last sync: {status.lastSyncedAt.toLocaleString()}
              </p>
            )}
            {syncError && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                Sync issue: {syncError}
              </p>
            )}
          </div>

          {/* Mode toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={!isLocalMode}
            aria-label={`Sync mode: ${isLocalMode ? 'Local-only' : 'Online'}. Click to switch.`}
            disabled={switching}
            onClick={() => void handleToggleMode()}
            className={`inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors select-none
              ${switching ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:opacity-80'}
              ${!isLocalMode
                ? 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400'
                : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span>{switching ? 'Switching…' : isLocalMode ? '📱 Local' : '🌐 Online'}</span>
            {/* Toggle track */}
            <span
              aria-hidden="true"
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors
                ${!isLocalMode ? 'bg-green-500' : 'bg-slate-400'}`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform
                  ${!isLocalMode ? 'translate-x-3.5' : 'translate-x-0.5'}`}
              />
            </span>
            {/* Pending badge */}
            {pendingChanges > 0 && (
              <span
                title={`${pendingChanges} unsynced change${pendingChanges > 1 ? 's' : ''}`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
              >
                {pendingChanges}
              </span>
            )}
          </button>
        </div>

        {/* ── Sync action buttons (hidden in local mode) ─────── */}
        {!isLocalMode && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isOnline || (isSyncing && !syncError) || isRequestingSync}
              onClick={() => void syncNow()}
            >
              {isRequestingSync ? 'Starting sync…' : 'Sync now'}
            </Button>
            {!isOnline && (
              <p className="w-full text-xs text-muted-foreground">
                Reconnect to sync local changes and download updates.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Confirmation dialog ────────────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch to Local-only mode?</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                You have{' '}
                <span className="font-semibold text-amber-600">
                  {pendingChanges} unsynced change{pendingChanges > 1 ? 's' : ''}
                </span>{' '}
                that haven&apos;t been uploaded to the server yet.
              </span>
              <span className="block">
                Your changes remain saved on this device and will upload the next
                time you switch back to Online.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-2">
            {/* Primary: sync first then go local */}
            <Button
              variant="default"
              disabled={!isOnline || switching}
              onClick={() => void syncThenSwitchToLocal()}
              className="w-full"
            >
              {switching
                ? 'Syncing…'
                : `Sync ${pendingChanges} change${pendingChanges > 1 ? 's' : ''} then go Local`}
            </Button>

            {/* Secondary: go local without syncing */}
            <Button
              variant="outline"
              disabled={switching}
              onClick={() => void switchToLocal()}
              className="w-full"
            >
              Go Local without syncing
            </Button>

            {/* Cancel */}
            <Button
              variant="ghost"
              disabled={switching}
              onClick={() => setShowConfirm(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
