export function getOfflineTenantStorageKey(userId: string) {
  return `bill:offline-tenant:${userId}`;
}

export function persistOfflineTenantSelection(userId: string, tenantId: string) {
  if (!userId.trim() || !tenantId.trim()) {
    throw new Error('A signed-in user and tenant are required to prepare offline access.');
  }

  try {
    window.localStorage.setItem(getOfflineTenantStorageKey(userId), tenantId);
  } catch (cause: unknown) {
    throw new Error('Could not save this device’s tenant selection for offline access.', { cause });
  }
}
