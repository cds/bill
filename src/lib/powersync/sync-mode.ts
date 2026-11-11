export type SyncMode = 'online' | 'local';

const KEY = 'powersync_sync_mode';

export function getSyncMode(): SyncMode {
  if (typeof localStorage === 'undefined') return 'online';
  return (localStorage.getItem(KEY) as SyncMode) ?? 'online';
}

export function setSyncMode(mode: SyncMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, mode);
}
