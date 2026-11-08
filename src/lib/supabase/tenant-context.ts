import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function getActiveTenantId() {
  const tenantId = (await headers()).get('x-tenant-id');
  if (!tenantId) redirect('/admin');
  return tenantId;
}
