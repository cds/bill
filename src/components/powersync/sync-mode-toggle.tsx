'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePowerSync, useStatus } from '@powersync/react';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';
import { getSyncMode, setSyncMode, type SyncMode } from '@/lib/powersync/sync-mode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * SyncModeToggle
 *
 * Replaces the plain ConnectionStatus badge in the app header.
 * Shows:
 *  - A coloured dot + label indicating the current sync mode and
 *    real network state.
 *  - A toggle switch to flip between Online (synced) and Local-only.
 *  - A confirmation dialog when switching to Local while unsynced
 *    changes exist, with a "Sync first" shortcut button.
 */
export function SyncModeToggle() {
  const database = usePowerSync();
  const status = useStatus();

  const [mode, setMode] = useState<SyncMode>('local');
  const [switching, setSwitching] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  // track network connectivity separately from sync mode
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);

  // ── Hydrate from localStorage + apply saved mode on mount ──────────
  useEffect(() => {
    setIsNetworkOnline(navigator.onLine);

    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const saved = getSyncMode();
    setMode(saved);
    // If the user previously chose local mode, disconnect on mount
    if (saved === 'local' && status.connected) {
      void database.disconnect();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Count pending (unsynced) changes ───────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    try {
      const batch = await database.getCrudBatch();
      setPendingChanges(batch ? batch.crud.length : 0);
    } catch {
      setPendingChanges(0);
    }
  }, [database]);

  useEffect(() => {
    void refreshPendingCount();
  }, [status.uploading, status.hasSynced, refreshPendingCount]);

  // ── Handle toggle click ────────────────────────────────────────────
  async function handleToggle() {
    if (mode === 'online') {
      // Switching to local: check for pending changes first
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
      setSyncMode('local');
      setMode('local');
    } finally {
      setSwitching(false);
      setShowConfirm(false);
    }
  }

  async function switchToOnline() {
    setSwitching(true);
    try {
      await database.connect(new SupabasePowerSyncConnector());
      setSyncMode('online');
      setMode('online');
    } finally {
      setSwitching(false);
    }
  }

  // Sync first, then switch to local
  async function syncThenSwitchToLocal() {
    setSwitching(true);
    try {
      // Temporarily allow sync so pending local changes can upload, then go local.
      setSyncMode('online');
      setMode('online');
      // Ensure connected for upload
      if (!status.connected) {
        await database.connect(new SupabasePowerSyncConnector());
      }
      // Wait briefly for the upload queue to drain (max 10 s)
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const batch = await database.getCrudBatch();
        if (!batch || batch.crud.length === 0) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      await switchToLocal();
    } finally {
      setSwitching(false);
      setShowConfirm(false);
    }
  }

  // ── Derived display values ─────────────────────────────────────────
  const isOnlineMode = mode === 'online';

  // Dot colour:
  //  green   = online mode + connected + network up
  //  amber   = online mode + syncing / connecting
  //  red     = online mode + network down
  //  slate   = local mode
  let dotClass = 'bg-slate-400';
  let labelText = '📱 Local';

  if (isOnlineMode) {
    if (!isNetworkOnline) {
      dotClass = 'bg-destructive';
      labelText = 'Offline';
    } else if (status.connecting || status.downloading || status.uploading) {
      dotClass = 'bg-amber-500 animate-pulse';
      labelText = 'Syncing…';
    } else if (status.connected) {
      dotClass = 'bg-green-500';
      labelText = 'Online';
    } else {
      dotClass = 'bg-amber-500';
      labelText = 'Reconnecting';
    }
  }

  return (
    <>
      {/* ── Toggle pill ─────────────────────────────────────── */}
      <button
        type="button"
        role="switch"
        aria-checked={isOnlineMode}
        aria-label={`Sync mode: ${labelText}. Click to switch to ${isOnlineMode ? 'local-only' : 'online'} mode.`}
        disabled={switching}
        onClick={() => void handleToggle()}
        title={`Currently in ${isOnlineMode ? 'Online' : 'Local-only'} mode. Click to switch.`}
        className={`inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors select-none
          ${switching ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:opacity-90'}
          ${isOnlineMode
            ? 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400'
            : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
      >
        {/* Animated dot */}
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full flex-shrink-0 transition-colors ${dotClass}`}
        />

        {/* Label */}
        <span>{switching ? 'Switching…' : labelText}</span>

        {/* Toggle track */}
        <span
          aria-hidden="true"
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ml-0.5
            ${isOnlineMode ? 'bg-green-500' : 'bg-slate-400'}`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform
              ${isOnlineMode ? 'translate-x-3.5' : 'translate-x-0.5'}`}
          />
        </span>

        {/* Pending badge */}
        {pendingChanges > 0 && isOnlineMode && (
          <span
            title={`${pendingChanges} unsynced change${pendingChanges > 1 ? 's' : ''}`}
            className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
          >
            {pendingChanges}
          </span>
        )}
      </button>

      {/* ── Confirmation dialog ──────────────────────────────── */}
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
              Switching to Local mode will pause sync. Your changes remain
              saved on this device and will upload the next time you switch
              back to Online.
            </span>
          </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-2">
            {/* Primary: sync first then go local */}
            <Button
              variant="default"
              disabled={!isNetworkOnline || switching}
              onClick={() => void syncThenSwitchToLocal()}
              className="w-full"
            >
              {switching ? 'Syncing…' : `Sync ${pendingChanges} change${pendingChanges > 1 ? 's' : ''} then go Local`}
            </Button>

            {/* Secondary: go local anyway */}
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
