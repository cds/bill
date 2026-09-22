import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyUuidButton } from '@/components/admin/copy-uuid-button';

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

  const { data: users, error } = await supabase
    .from('users')
    .select(`
      id, 
      system_role, 
      created_at,
      tenant_members (
        role,
        tenants (
          name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title="Global Users" 
        description="Super Admin view of all users and their mapped business tenants. Copy a UUID to assign them to a new business."
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID (UUID)</TableHead>
                <TableHead>System Role</TableHead>
                <TableHead>Tenant Memberships</TableHead>
                <TableHead>Joined Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                      {u.id}
                      <CopyUuidButton uuid={u.id} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.system_role === 'super_admin' ? 'default' : 'secondary'}>
                      {u.system_role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.tenant_members?.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {u.tenant_members.map((tm: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{tm.tenants?.name}</span>
                            <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">{tm.role}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No tenants</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!users?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
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
