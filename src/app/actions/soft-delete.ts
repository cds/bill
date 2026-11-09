'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function softDeleteRecord(tableName: string, id: string, reason: string) {
  const allowedTables = [
    'items',
    'parties',
    'expenses',
  ];

  if (!allowedTables.includes(tableName)) {
    const error = tableName === 'invoices'
      ? 'Sales must be voided so stock and party balances can be reversed safely.'
      : tableName === 'invoice_items'
        ? 'Sale line items can only be changed through the sale edit or void flow.'
        : tableName === 'stock_adjustments'
          ? 'Stock adjustments are immutable; create a correcting adjustment instead.'
          : 'Invalid table name provided for soft deletion.';
    return { error };
  }
  if (!reason.trim()) {
    return { error: 'A reason is required to discard this record.' };
  }

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

  const { error } = await supabase
    .from(tableName)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason.trim(),
    })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  // Revalidate the route corresponding to the table
  revalidatePath(`/${tableName}`);
  
  return { success: true };
}
