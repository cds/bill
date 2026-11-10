// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
});
