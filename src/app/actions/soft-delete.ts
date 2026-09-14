'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function softDeleteRecord(tableName: string, id: string) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Strict allowlist for security
  const allowedTables = [
    'items',
    'parties',
    'invoices',
    'invoice_items',
    'stock_adjustments',
    'expenses'
  ];

  if (!allowedTables.includes(tableName)) {
    return { error: 'Invalid table name provided for soft deletion.' };
  }

  // Soft delete using the database structure
  const { error } = await supabase
    .from(tableName)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  // Revalidate the route corresponding to the table
  revalidatePath(`/${tableName === 'invoices' ? 'sales' : tableName}`);
  
  return { success: true };
}

