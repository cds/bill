'use client';

import { PowerSyncContext } from '@powersync/react';
import type { PowerSyncDatabase } from '@powersync/web';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

type PowerSyncProviderProps = {
  tenantId: string;
  children: ReactNode;
  fallback?: ReactNode;
};

type PowerSyncConnectionProviderProps = PowerSyncProviderProps & {
  initializeDatabase: (tenantId: string) => Promise<PowerSyncDatabase>;
};

async function loadPowerSyncDatabase(tenantId: string) {
  const { getPowerSyncDatabase } = await import('./client');
  return getPowerSyncDatabase(tenantId);
}

export function PowerSyncProvider(props: PowerSyncProviderProps) {
  return (
    <PowerSyncConnectionProvider
      {...props}
      initializeDatabase={loadPowerSyncDatabase}
    />
  );
}

export function PowerSyncConnectionProvider({
  tenantId,
  children,
  fallback,
  initializeDatabase,
}: PowerSyncConnectionProviderProps) {
  const [connection, setConnection] = useState<{
    tenantId: string;
    database: PowerSyncDatabase;
  } | null>(null);
  const [initializationError, setInitializationError] = useState<{
    tenantId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let authGeneration = 0;

    const initialize = async () => {
      const generation = authGeneration;
      try {
        const instance = await initializeDatabase(tenantId);
        if (!cancelled && generation === authGeneration) {
          setConnection({ tenantId, database: instance });
          setInitializationError(null);
        }
      } catch (cause: unknown) {
        if (!cancelled && generation === authGeneration) {
          setInitializationError({
            tenantId,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    };

    void initialize();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((
      event: AuthChangeEvent,
      session: Session | null,
    ) => {
      if (event === 'SIGNED_OUT') {
        authGeneration += 1;
        setConnection(null);
        setInitializationError(null);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        authGeneration += 1;
        setConnection(null);
        setInitializationError(null);
        void initialize();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initializeDatabase, tenantId]);

  if (initializationError?.tenantId === tenantId) {
    return <div role="alert">PowerSync initialization failed: {initializationError.message}</div>;
  }
  if (!connection || connection.tenantId !== tenantId) {
    return <>{fallback ?? <div role="status">Initializing offline database…</div>}</>;
  }

  return (
    <PowerSyncContext.Provider value={connection.database}>
      {children}
    </PowerSyncContext.Provider>
  );
}
