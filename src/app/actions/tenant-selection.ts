'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ACTIVE_TENANT_COOKIE } from '@/lib/tenant-selection';

export async function selectActiveTenant(tenantId: string) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: roleData, error: roleError } = await supabase
    .from('users')
    .select('system_role')
    .eq('id', user.id)
    .single();

  if (roleError || roleData?.system_role !== 'super_admin') {
    return { error: 'Forbidden' };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) return { error: tenantError.message };
  if (!tenant) return { error: 'Tenant not found' };

  cookieStore.set(ACTIVE_TENANT_COOKIE, tenant.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
