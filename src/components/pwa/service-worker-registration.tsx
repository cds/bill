'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.error('Failed to register the offline app shell:', error);
    });
  }, []);

  return null;
}
