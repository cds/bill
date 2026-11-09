import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { AuditLogTable } from '@/components/admin/audit-log-table';
import { Card, CardContent } from '@/components/ui/card';

type AuditLog = {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'SOFT_DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  created_at_label: string;
  tenants: { name: string } | null;
};

export default async function AdminLogsPage() {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: roleData, error: roleError } = await supabase
    .from('users')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle();

  if (roleError) {
    throw new Error(`Failed to verify admin role: ${roleError.message}`);
  }
  if (roleData?.system_role !== 'super_admin') redirect('/');

  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      tenants(name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  const logs = ((data ?? []) as Omit<AuditLog, 'created_at_label'>[]).map((log) => ({
    ...log,
    created_at_label: new Date(log.created_at).toLocaleString(),
  }));
  const userIds = new Set(
    logs.flatMap((log) => log.user_id ? [log.user_id] : [])
  );
  const invoiceIds = logs.flatMap((log) =>
    log.table_name === 'invoices' ? [log.record_id] : []
  );

  const [actors, invoiceItemsByInvoiceId] = await Promise.all([
    (async () => {
      const actors = new Map<string, { name: string; email: string | null }>();
      if (userIds.size === 0) return {};

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to load audit log actors.');
      }

      const adminSupabase = createSupabaseAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      for (let page = 1; ; page += 1) {
        const { data: authUsers, error: authUsersError } = await adminSupabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

        if (authUsersError) {
          throw new Error(`Failed to load audit log actors: ${authUsersError.message}`);
        }

        for (const actor of authUsers.users) {
          if (!userIds.has(actor.id)) continue;

          const metadata = actor.user_metadata;
          const name = [
            metadata?.full_name,
            metadata?.name,
            actor.email,
          ].find((value): value is string => typeof value === 'string' && value.length > 0);

          if (name) {
            actors.set(actor.id, { name, email: actor.email ?? null });
          }
        }

        if (actors.size === userIds.size || authUsers.users.length < 1000) break;
      }

      return Object.fromEntries(actors);
    })(),
    (async () => {
      const invoiceItemsByInvoiceId: Record<
        string,
        Array<{ item_name: string; quantity: number; unit: string; rate: number; amount: number }>
      > = {};
      if (invoiceIds.length === 0) return invoiceItemsByInvoiceId;

      const { data: invoiceItems, error: invoiceItemsError } = await supabase
        .from('invoice_items')
        .select('invoice_id, item_name, quantity, unit, rate, amount')
        .in('invoice_id', [...new Set(invoiceIds)]);

      if (invoiceItemsError) {
        throw new Error(`Failed to load sale line items for audit logs: ${invoiceItemsError.message}`);
      }

      for (const item of invoiceItems ?? []) {
        const invoiceId = item.invoice_id;
        invoiceItemsByInvoiceId[invoiceId] ??= [];
        invoiceItemsByInvoiceId[invoiceId].push({
          item_name: item.item_name,
          quantity: Number(item.quantity),
          unit: item.unit,
          rate: Number(item.rate),
          amount: Number(item.amount),
        });
      }

      return invoiceItemsByInvoiceId;
    })(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title="Global Audit Logs" 
        description="Super Admin view of all actions performed across all tenants."
      />

      <Card>
        <CardContent className="p-0">
          <AuditLogTable
            logs={logs}
            actors={actors}
            invoiceItemsByInvoiceId={invoiceItemsByInvoiceId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
