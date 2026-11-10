'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);

  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return null;
}

export function ConnectionStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = isOnline === null ? 'Checking connection' : isOnline ? 'Online' : 'Offline';

  return (
    <span
      role="status"
      aria-label={`Connection status: ${label}`}
      title="Based on your browser’s network status"
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs font-medium ${
        isOnline === false
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : isOnline === true
            ? 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400'
            : 'border-border bg-muted text-muted-foreground'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          isOnline === false ? 'bg-destructive' : isOnline === true ? 'bg-green-600' : 'bg-muted-foreground'
        }`}
      />
      {label}
    </span>
  );
}
