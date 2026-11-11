// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineSyncStatus } from '@/components/powersync/offline-sync-status';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';
import { setSyncMode, getSyncMode } from '@/lib/powersync/sync-mode';

const { mockConnect, mockDisconnect, mockGetCrudBatch, mockUseStatus } = vi.hoisted(() => ({
  mockConnect: vi.fn().mockResolvedValue(undefined),
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
  mockGetCrudBatch: vi.fn().mockResolvedValue(null),
  mockUseStatus: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    getCrudBatch: mockGetCrudBatch,
  }),
  useStatus: () => mockUseStatus(),
}));

describe('offline sync status & manual mode toggle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    setSyncMode('online');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    mockUseStatus.mockReturnValue({
      connected: true,
      connecting: false,
      downloading: false,
      uploading: false,
      hasSynced: true,
      lastSyncedAt: new Date('2026-11-10T07:00:00.000Z'),
      downloadError: undefined,
      uploadError: undefined,
    });
    mockGetCrudBatch.mockResolvedValue(null);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows local sync state and lets the user request a sync in online mode', async () => {
    await act(async () => root.render(<OfflineSyncStatus />));

    expect(container.textContent).toContain('Synced to this device');
    expect(container.textContent).toContain('Last sync:');
    const syncButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Sync now'));
    expect(syncButton?.disabled).toBe(false);

    await act(async () => syncButton?.click());

    expect(mockConnect).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledWith(expect.any(SupabasePowerSyncConnector));
  });

  it('shows a not-yet-synced state and disables sync while offline in online mode', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    mockUseStatus.mockReturnValue({
      connected: false,
      connecting: false,
      downloading: false,
      uploading: false,
      hasSynced: false,
      lastSyncedAt: undefined,
      downloadError: undefined,
      uploadError: undefined,
    });

    await act(async () => root.render(<OfflineSyncStatus />));

    expect(container.textContent).toContain('Not synced to this device');
    expect(container.textContent).toContain('Reconnect to sync local changes');
    const syncButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Sync now'));
    expect(syncButton?.disabled).toBe(true);
  });

  it('surfaces PowerSync errors while keeping retry available online', async () => {
    mockUseStatus.mockReturnValue({
      connected: false,
      connecting: false,
      downloading: false,
      uploading: false,
      hasSynced: false,
      lastSyncedAt: undefined,
      downloadError: new Error('Temporary service outage'),
      uploadError: undefined,
    });

    await act(async () => root.render(<OfflineSyncStatus />));

    expect(container.textContent).toContain('Sync issue: Temporary service outage');
    const syncButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Sync now'));
    expect(syncButton?.disabled).toBe(false);
  });

  it('switches from online mode to local mode when toggled (disconnects PowerSync)', async () => {
    await act(async () => root.render(<OfflineSyncStatus />));

    expect(container.textContent).toContain('Online');
    const toggleButton = container.querySelector('button[role="switch"]');
    expect(toggleButton).toBeTruthy();

    // Click toggle to switch to Local mode
    await act(async () => toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(mockDisconnect).toHaveBeenCalled();
    expect(getSyncMode()).toBe('local');
    expect(container.textContent).toContain('Local');
    expect(container.textContent).toContain('Local-only mode · sync paused');

    // Sync now button should be hidden in local mode
    const syncButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Sync now'));
    expect(syncButton).toBeUndefined();
  });

  it('switches back from local mode to online mode and reconnects PowerSync', async () => {
    setSyncMode('local');
    mockUseStatus.mockReturnValue({
      connected: false,
      connecting: false,
      downloading: false,
      uploading: false,
      hasSynced: true,
      lastSyncedAt: new Date('2026-11-10T07:00:00.000Z'),
      downloadError: undefined,
      uploadError: undefined,
    });

    await act(async () => root.render(<OfflineSyncStatus />));

    expect(container.textContent).toContain('Local-only mode · sync paused');
    const toggleButton = container.querySelector('button[role="switch"]');
    expect(toggleButton).toBeTruthy();

    // Click toggle to switch to Online mode
    await act(async () => toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(getSyncMode()).toBe('online');
    expect(mockConnect).toHaveBeenCalledWith(expect.any(SupabasePowerSyncConnector));
    expect(container.textContent).toContain('Online');
  });

  it('prompts confirmation when switching to local mode if unsynced pending changes exist', async () => {
    mockGetCrudBatch.mockResolvedValue({
      crud: [
        { id: 'item-1', op: 'PUT', table: 'items', opData: { name: 'Local item' } },
      ],
    });

    await act(async () => root.render(<OfflineSyncStatus />));

    const toggleButton = container.querySelector('button[role="switch"]');
    await act(async () => toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    // Modal should appear
    expect(document.body.textContent).toContain('Switch to Local-only mode?');
    expect(document.body.textContent).toContain('1 unsynced change');
    expect(document.body.textContent).toContain('Sync 1 change then go Local');
    expect(document.body.textContent).toContain('Go Local without syncing');

    // Clicking "Go Local without syncing" should disconnect and set mode to local
    const goLocalButton = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Go Local without syncing')
    );
    await act(async () => goLocalButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(mockDisconnect).toHaveBeenCalled();
    expect(getSyncMode()).toBe('local');
  });
});
