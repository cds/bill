'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

async function getAdminSupabase() {
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

  // Verify super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: roleData } = await supabase.from('users').select('system_role').eq('id', user.id).single();
  if (roleData?.system_role !== 'super_admin') throw new Error('Forbidden');

  return supabase;
}

export async function createTenant(name: string, status: string) {
  try {
    const supabase = await getAdminSupabase();
    const { error } = await supabase.from('tenants').insert({ name, status });
    if (error) throw error;
    
    revalidatePath('/admin/tenants');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateTenant(id: string, name: string, status: string) {
  try {
    const supabase = await getAdminSupabase();
    const { error } = await supabase.from('tenants').update({ name, status }).eq('id', id);
    if (error) throw error;
    
    revalidatePath('/admin/tenants');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteTenant(id: string) {
  try {
    const supabase = await getAdminSupabase();
    const { error } = await supabase.from('tenants').delete().eq('id', id);
    if (error) throw error;
    
    revalidatePath('/admin/tenants');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function addTenantMember(tenant_id: string, user_id: string, role: string) {
  try {
    const supabase = await getAdminSupabase();
    
    // Check if user exists in auth (optional but good practice, though we can't easily query auth.users from here)
    // We will just insert into tenant_members and rely on foreign key constraints.
    const { error } = await supabase.from('tenant_members').insert({
      tenant_id,
      user_id,
      role
    });
    
    if (error) {
      if (error.code === '23503') throw new Error('User UUID not found in the system.');
      if (error.code === '23505') throw new Error('User is already a member of this tenant.');
      throw error;
    }
    
    revalidatePath('/admin/tenants');
    revalidatePath('/team');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
