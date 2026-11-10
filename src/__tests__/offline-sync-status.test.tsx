// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineSyncStatus } from '@/components/powersync/offline-sync-status';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';

const { mockConnect, mockUseStatus } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockUseStatus: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ connect: mockConnect }),
  useStatus: () => mockUseStatus(),
}));

describe('offline sync status', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('shows local sync state and lets the user request a sync', async () => {
    await act(async () => root.render(<OfflineSyncStatus />));

    expect(container.textContent).toContain('Synced to this device');
    expect(container.textContent).toContain('Last successful sync:');
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(false);

    await act(async () => button?.click());

    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockConnect).toHaveBeenCalledWith(expect.any(SupabasePowerSyncConnector));
  });

  it('shows a not-yet-synced state and disables sync while offline', async () => {
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
    expect(container.querySelector('button')?.disabled).toBe(true);
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
    expect(container.querySelector('button')?.disabled).toBe(false);
  });
});
