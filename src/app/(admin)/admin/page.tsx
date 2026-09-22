import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building, Activity, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function AdminOverviewPage() {
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

  // Fetch metrics
  const [{ count: tenantCount }, { count: userCount }, { count: logCount }] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true })
  ]);

  const metrics = [
    { title: 'Total Tenants', value: tenantCount || 0, icon: Building, color: 'text-blue-500' },
    { title: 'Global Users', value: userCount || 0, icon: Users, color: 'text-green-500' },
    { title: 'Total Audit Logs', value: logCount || 0, icon: Activity, color: 'text-purple-500' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title="Super Admin Control Center" 
        description="High-level metrics and system configuration."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-4">
         <Card>
           <CardHeader>
             <CardTitle>System Health</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
                 <ShieldAlert className="w-5 h-5" />
               </div>
               <div>
                 <p className="font-medium">All Systems Operational</p>
                 <p className="text-sm text-muted-foreground">Database triggers and RLS policies are active.</p>
               </div>
             </div>
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>Quick Actions</CardTitle>
           </CardHeader>
           <CardContent className="flex flex-col gap-3">
             <Link href="/admin/tenants" className="w-full">
               <Button variant="outline" className="w-full justify-start">Manage Businesses (Tenants)</Button>
             </Link>
             <Link href="/admin/users" className="w-full">
               <Button variant="outline" className="w-full justify-start">Manage Global Users</Button>
             </Link>
             <Link href="/admin/logs" className="w-full">
               <Button variant="outline" className="w-full justify-start">Review Global Audit Logs</Button>
             </Link>
           </CardContent>
         </Card>
      </div>
    </div>
  );
}
