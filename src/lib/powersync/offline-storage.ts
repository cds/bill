export function getOfflineTenantStorageKey(userId: string) {
  return `bill:offline-tenant:${userId}`;
}
