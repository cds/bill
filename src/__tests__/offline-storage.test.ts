// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discoverOfflineTenants,
  getOfflineTenantStorageKey,
  persistOfflineTenantSelection,
} from '@/lib/powersync/offline-storage';

describe('offline tenant selection persistence', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('stores the PowerSync tenant for the authenticated user', () => {
    persistOfflineTenantSelection('user-a', 'tenant-a');

    expect(window.localStorage.getItem(getOfflineTenantStorageKey('user-a')))
      .toBe('tenant-a');
    expect(window.localStorage.getItem(getOfflineTenantStorageKey('user-b')))
      .toBeNull();
  });

  it('rejects missing user or tenant context', () => {
    expect(() => persistOfflineTenantSelection('', 'tenant-a'))
      .toThrow('A signed-in user and tenant are required');
    expect(() => persistOfflineTenantSelection('user-a', ' '))
      .toThrow('A signed-in user and tenant are required');
  });

  it('surfaces browser storage failures', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });

    expect(() => persistOfflineTenantSelection('user-a', 'tenant-a'))
      .toThrow('Could not save this device’s tenant selection');
    setItem.mockRestore();
  });

  it('discovers only tenant databases belonging to the signed-in user', async () => {
    vi.stubGlobal('indexedDB', {
      databases: vi.fn().mockResolvedValue([
        { name: 'bill-user-a-11111111-1111-4111-8111-111111111111.db' },
        { name: 'bill-user-a-not-a-tenant.db' },
        { name: 'bill-user-b-22222222-2222-4222-8222-222222222222.db' },
      ]),
    });

    await expect(discoverOfflineTenants('user-a'))
      .resolves.toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('returns null when the browser cannot enumerate IndexedDB databases', async () => {
    vi.stubGlobal('indexedDB', {});

    await expect(discoverOfflineTenants('user-a')).resolves.toBeNull();
  });

  it('rejects discovery without a signed-in user', async () => {
    await expect(discoverOfflineTenants(' '))
      .rejects.toThrow('A signed-in user is required');
  });
});
