// @vitest-environment jsdom

import { act, useContext } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PowerSyncContext } from '@powersync/react';
import { PowerSyncProvider } from '@/lib/powersync/provider';

const authState = vi.hoisted(() => ({
  listener: null as ((event: string, session: unknown) => void) | null,
}));
const getPowerSyncDatabase = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (listener: typeof authState.listener) => {
        authState.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

vi.mock('@/lib/powersync/client', () => ({ getPowerSyncDatabase }));

function DatabaseName() {
  const database = useContext(PowerSyncContext);
  return <span>{database ? (database as { name: string }).name : 'locked'}</span>;
}

describe('PowerSyncProvider tenant and auth isolation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.listener = null;
    getPowerSyncDatabase.mockImplementation(async (tenantId: string) => ({
      name: tenantId,
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('hides the previous tenant database immediately when tenant context changes', async () => {
    await act(async () => {
      root.render(
        <PowerSyncProvider tenantId="tenant-a">
          <DatabaseName />
        </PowerSyncProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe('tenant-a');

    await act(async () => {
      root.render(
        <PowerSyncProvider tenantId="tenant-b">
          <DatabaseName />
        </PowerSyncProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toBe('tenant-b');
    expect(getPowerSyncDatabase).toHaveBeenNthCalledWith(1, 'tenant-a');
    expect(getPowerSyncDatabase).toHaveBeenNthCalledWith(2, 'tenant-b');
  });

  it('locks local data on sign-out and reopens only after a signed-in database is initialized', async () => {
    await act(async () => {
      root.render(
        <PowerSyncProvider tenantId="tenant-a">
          <DatabaseName />
        </PowerSyncProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe('tenant-a');

    await act(async () => {
      authState.listener?.('SIGNED_OUT', null);
    });
    expect(container.textContent).toBe('Initializing offline database…');

    await act(async () => {
      authState.listener?.('SIGNED_IN', { user: { id: 'another-user' } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe('tenant-a');
    expect(getPowerSyncDatabase).toHaveBeenCalledTimes(2);
  });
});
