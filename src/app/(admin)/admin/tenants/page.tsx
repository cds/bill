import { createServerClient } from '@supabase/ssr';
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

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tenants:', error);
  }

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
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                      {tenant.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <TenantUsersDialog
                        tenantId={tenant.id}
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
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
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
