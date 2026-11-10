const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getOfflineTenantStorageKey(userId: string) {
  return `bill:offline-tenant:${userId}`;
}

export async function discoverOfflineTenants(userId: string): Promise<string[] | null> {
  if (!userId.trim()) {
    throw new Error('A signed-in user is required to discover offline databases.');
  }
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
    return null;
  }

  const prefix = `bill-${userId}-`;
  const databases = await indexedDB.databases();
  const tenantIds = new Set<string>();

  for (const database of databases) {
    const name = database.name;
    if (!name?.startsWith(prefix) || !name.endsWith('.db')) continue;

    const tenantId = name.slice(prefix.length, -'.db'.length);
    if (UUID_PATTERN.test(tenantId)) tenantIds.add(tenantId);
  }

  return [...tenantIds];
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
