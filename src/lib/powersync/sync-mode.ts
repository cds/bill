export type SyncMode = 'online' | 'local';

const KEY = 'powersync_sync_mode';
const EVENT_NAME = 'powersync_sync_mode_changed';

export function getSyncMode(): SyncMode {
  if (typeof localStorage === 'undefined') return 'online';
  return (localStorage.getItem(KEY) as SyncMode) ?? 'online';
}

export function setSyncMode(mode: SyncMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: mode }));
}

export function subscribeSyncMode(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}
