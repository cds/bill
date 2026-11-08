import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyUuidButton } from '@/components/admin/copy-uuid-button';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
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
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to load Global Users.');
  }

  const adminSupabase = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const authUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Failed to load Auth users: ${error.message}`);
    }

    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const [profiles, tenantMembers] = await Promise.all([
    (async () => {
      const allProfiles = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await adminSupabase
          .from('users')
          .select('id, system_role')
          .range(from, from + 999);

        if (error) {
          throw new Error(`Failed to load user system roles: ${error.message}`);
        }

        allProfiles.push(...data);
        if (data.length < 1000) return allProfiles;
      }
    })(),
    (async () => {
      const allTenantMembers = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await adminSupabase
          .from('tenant_members')
          .select('user_id, role, tenants(name)')
          .range(from, from + 999);

        if (error) {
          throw new Error(`Failed to load tenant roles: ${error.message}`);
        }

        allTenantMembers.push(...data);
        if (data.length < 1000) return allTenantMembers;
      }
    })(),
  ]);

  const systemRolesByUserId = new Map(
    profiles.map((profile) => [profile.id, profile.system_role])
  );
  const tenantRolesByUserId = new Map<
    string,
    Array<{ role: string | null; tenantName: string | null }>
  >();

  for (const membership of tenantMembers) {
    const userMemberships = tenantRolesByUserId.get(membership.user_id) ?? [];
    const tenant = Array.isArray(membership.tenants)
      ? membership.tenants[0]
      : membership.tenants;
    userMemberships.push({
      role: membership.role,
      tenantName: tenant?.name ?? null,
    });
    tenantRolesByUserId.set(membership.user_id, userMemberships);
  }

  const formatRole = (role: string) =>
    role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title="Global Users" 
        description="All Supabase Auth users with their assigned system and tenant roles."
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Assigned Roles</TableHead>
                <TableHead>Joined Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authUsers.map((authUser) => {
                const systemRole = systemRolesByUserId.get(authUser.id);
                const tenantRoles = tenantRolesByUserId.get(authUser.id) ?? [];
                const metadataName = authUser.user_metadata?.full_name
                  ?? authUser.user_metadata?.name
                  ?? authUser.user_metadata?.display_name;
                const displayName = typeof metadataName === 'string'
                  ? metadataName
                  : authUser.email ?? 'No name provided';

                return (
                  <TableRow key={authUser.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{displayName}</span>
                        {authUser.email && (
                          <span className="text-sm text-muted-foreground">{authUser.email}</span>
                        )}
                        <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                          {authUser.id}
                          <CopyUuidButton uuid={authUser.id} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {systemRole ? (
                          <Badge variant={systemRole === 'super_admin' ? 'default' : 'secondary'}>
                            {formatRole(systemRole)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No system role</Badge>
                        )}
                        {tenantRoles.map((tenantRole, index) => (
                          <Badge key={`${tenantRole.tenantName}-${tenantRole.role}-${index}`} variant="outline">
                            {tenantRole.tenantName ? `${tenantRole.tenantName}: ` : ''}
                            {tenantRole.role ? formatRole(tenantRole.role) : 'Unknown role'}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(authUser.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
              {!authUsers.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                    No users found.
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
