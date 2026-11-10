// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineApp } from '@/components/pwa/offline-app';
import { getOfflineTenantStorageKey } from '@/lib/powersync/offline-storage';

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mockGetSession } }),
}));

vi.mock('@/lib/powersync/offline-provider', () => ({
  OfflinePowerSyncProvider: ({
    tenantId,
    children,
  }: {
    tenantId: string;
    children: React.ReactNode;
  }) => <div data-tenant-id={tenantId}>{children}</div>,
}));

vi.mock('@/components/powersync/offline-workspace', () => ({
  OfflineWorkspace: ({ tenantId }: { tenantId: string }) => (
    <p>Workspace tenant: {tenantId}</p>
  ),
}));

describe('offline app entry', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.history.replaceState(null, '', '/offline-app?requested=%2Foffline-workspace');
    window.localStorage.clear();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
      error: null,
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

  it('opens only the signed-in user’s saved tenant database', async () => {
    window.localStorage.setItem(getOfflineTenantStorageKey('user-a'), 'tenant-a');

    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Workspace tenant: tenant-a');
    expect(container.querySelector('[data-tenant-id="tenant-a"]')).not.toBeNull();
  });

  it('does not open local data without a signed-in session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('No signed-in account is available');
    expect(container.textContent).not.toContain('Workspace tenant:');
  });

  it('explains that tenant context must be prepared online once', async () => {
    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('no saved tenant selection');
    expect(container.textContent).not.toContain('Workspace tenant:');
  });

  it('does not turn a requested external URL into a retry link', async () => {
    window.history.replaceState(null, '', '/offline-app?requested=%2F%2Fevil.example');
    window.localStorage.setItem(getOfflineTenantStorageKey('user-a'), 'tenant-a');

    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const retryLink = container.querySelector('a');
    expect(retryLink).toBeNull();
  });
});
