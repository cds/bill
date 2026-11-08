import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Plus, UserCog } from 'lucide-react';
import { TenantDialog } from '@/components/admin/tenant-dialog';
import { DeleteTenantButton } from '@/components/admin/delete-tenant-button';
import { TenantUsersDialog } from '@/components/admin/tenant-users-dialog';

export const dynamic = 'force-dynamic';

export default async function AdminTenantsPage() {
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
    .single();

  if (roleError || roleData?.system_role !== 'super_admin') {
    redirect('/');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to load tenant users.');
  }

  const adminSupabase = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [{ data: tenants, error: tenantsError }, tenantUsers, authUsers] = await Promise.all([
    adminSupabase
    .from('tenants')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false }),
    (async () => {
      const allTenantUsers = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await adminSupabase
          .from('tenant_members')
          .select('tenant_id, user_id, role')
          .range(from, from + 999);

        if (error) {
          throw new Error(`Failed to load tenant memberships: ${error.message}`);
        }

        allTenantUsers.push(...data);
        if (data.length < 1000) return allTenantUsers;
      }
    })(),
    (async () => {
      const allAuthUsers = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await adminSupabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

        if (error) {
          throw new Error(`Failed to load Auth users: ${error.message}`);
        }

        allAuthUsers.push(...data.users);
        if (data.users.length < 1000) return allAuthUsers;
      }
    })(),
  ]);

  if (tenantsError) {
    throw new Error(`Failed to load tenants: ${tenantsError.message}`);
  }

  const usersWithEmail = authUsers.flatMap((authUser) =>
    authUser.email ? [{ id: authUser.id, email: authUser.email }] : []
  );
  const emailByUserId = new Map(
    authUsers.flatMap((authUser) =>
      authUser.email ? [[authUser.id, authUser.email] as const] : []
    )
  );
  const tenantUsersByTenantId = new Map<
    string,
    Array<{ userId: string; role: string | null }>
  >();

  for (const membership of tenantUsers) {
    const members = tenantUsersByTenantId.get(membership.tenant_id) ?? [];
    members.push({ userId: membership.user_id, role: membership.role });
    tenantUsersByTenantId.set(membership.tenant_id, members);
  }

  const formatRole = (role: string) =>
    role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Manage Tenants" 
          description="Super Admin view of all businesses (tenants) registered on the platform."
        />
        <TenantDialog trigger={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Tenant
          </Button>
        } />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Tenant Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants?.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{tenant.id}</TableCell>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {(tenantUsersByTenantId.get(tenant.id) ?? []).map((member) => (
                        <div key={member.userId} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">
                            {emailByUserId.get(member.userId) ?? 'Email unavailable'}
                          </span>
                          {member.role ? (
                            <Badge variant="outline">{formatRole(member.role)}</Badge>
                          ) : (
                            <Badge variant="outline">Unknown role</Badge>
                          )}
                        </div>
                      ))}
                      {!tenantUsersByTenantId.get(tenant.id)?.length && (
                        <span className="text-sm text-muted-foreground">No users assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                      {tenant.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <TenantUsersDialog
                        tenantId={tenant.id}
                        users={usersWithEmail}
                        trigger={
                          <Button variant="ghost" size="icon" title="Assign User">
                            <UserCog className="w-4 h-4 text-blue-600" />
                          </Button>
                        }
                      />
                      <TenantDialog 
                        tenant={tenant}
                        trigger={
                          <Button variant="ghost" size="icon" title="Edit Tenant">
                            <Edit className="w-4 h-4" />
                          </Button>
                        } 
                      />
                      <DeleteTenantButton id={tenant.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!tenants?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    No tenants found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
