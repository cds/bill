'use client';

import { getPowerSyncDatabase } from './client';
import { PowerSyncConnectionProvider } from './provider';
import type { ReactNode } from 'react';

export function OfflinePowerSyncProvider({
  tenantId,
  children,
  fallback,
}: {
  tenantId: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PowerSyncConnectionProvider
      tenantId={tenantId}
      initializeDatabase={getPowerSyncDatabase}
      fallback={fallback}
    >
      {children}
    </PowerSyncConnectionProvider>
  );
}
