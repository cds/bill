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

vi.mock('@/components/expenses/offline-expenses', () => ({
  OfflineExpenses: ({ tenantId }: { tenantId: string }) => (
    <p>Local expenses tenant: {tenantId}</p>
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
    vi.unstubAllGlobals();
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

  it('opens local expense entry when the failed route was /expenses', async () => {
    window.history.replaceState(null, '', '/offline-app?requested=%2Fexpenses');
    window.localStorage.setItem(getOfflineTenantStorageKey('user-a'), 'tenant-a');

    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Local expenses tenant: tenant-a');
    expect(container.textContent).not.toContain('needs an internet connection');
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

  it('recovers the tenant from the signed-in user’s existing local database', async () => {
    vi.stubGlobal('indexedDB', {
      databases: vi.fn().mockResolvedValue([
        { name: 'bill-user-a-11111111-1111-4111-8111-111111111111.db' },
        { name: 'bill-user-b-22222222-2222-4222-8222-222222222222.db' },
      ]),
    });

    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain(
      'Workspace tenant: 11111111-1111-4111-8111-111111111111',
    );
    expect(window.localStorage.getItem(getOfflineTenantStorageKey('user-a')))
      .toBe('11111111-1111-4111-8111-111111111111');
  });

  it('explains how to prepare local data when no tenant database exists', async () => {
    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('No local PowerSync database was found');
    expect(container.textContent).not.toContain('Workspace tenant:');
  });

  it('asks the user to choose when multiple local tenant databases exist', async () => {
    vi.stubGlobal('indexedDB', {
      databases: vi.fn().mockResolvedValue([
        { name: 'bill-user-a-11111111-1111-4111-8111-111111111111.db' },
        { name: 'bill-user-a-22222222-2222-4222-8222-222222222222.db' },
      ]),
    });

    await act(async () => {
      root.render(<OfflineApp />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Choose a local workspace');
    expect(container.textContent).not.toContain('Workspace tenant:');
    const buttons = container.querySelectorAll('button');
    await act(async () => buttons[1].click());
    expect(container.textContent).toContain(
      'Workspace tenant: 22222222-2222-4222-8222-222222222222',
    );
    expect(window.localStorage.getItem(getOfflineTenantStorageKey('user-a')))
      .toBe('22222222-2222-4222-8222-222222222222');
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
