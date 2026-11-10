'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOfflineTenantStorageKey } from '@/lib/powersync/offline-storage';

export function OfflineTenantPersistence({
  tenantId,
  enabled,
}: {
  tenantId?: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !tenantId) return;

    let active = true;
    const supabase = createClient();

    void (async () => {
      try {
        const result = await supabase.auth.getSession();
        if (result.error) {
          console.error('Failed to store the offline tenant selection:', result.error);
          return;
        }

        const userId = result.data.session?.user.id;
        if (active && userId) {
          window.localStorage.setItem(getOfflineTenantStorageKey(userId), tenantId);
        }
      } catch (cause: unknown) {
        console.error('Failed to persist the offline tenant selection:', cause);
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled, tenantId]);

  return null;
}
