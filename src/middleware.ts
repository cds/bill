import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ACTIVE_TENANT_COOKIE } from '@/lib/tenant-selection';

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-tenant-id');
  requestHeaders.delete('x-tenant-role');
  requestHeaders.delete('x-system-role');
  
  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate the Supabase session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login');
  const isSetupPage = pathname.startsWith('/setup');
  const isAdminPage = pathname.startsWith('/admin');

  // Route Protection: Unauthenticated users go to /login
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-Based Routing for Authenticated Users
  if (user) {
    // Fetch system_role and tenant membership in parallel to cut latency in half
    const [userRes, memberRes] = await Promise.all([
      supabase
        .from('users')
        .select('system_role')
        .eq('id', user.id)
        .single(),
      supabase
        .from('tenant_members')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single(),
    ]);
    
    const systemRole = userRes.data?.system_role || 'user';
    const memberData = memberRes.data;

    // 1. Redirect away from login if already authenticated
    if (isAuthPage) {
      const target = systemRole === 'super_admin' ? '/admin' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }

    // 2. Super Admin Access to Admin Pages
    if (systemRole === 'super_admin' && isAdminPage) {
      return supabaseResponse; // Allow direct access to admin pages without tenant context
    }

    // 3. Kick standard users out of the admin panel
    if (systemRole !== 'super_admin' && isAdminPage) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // 4. Resolve Tenant Context (For ALL users trying to access the dashboard, including Super Admins)
    if (!isSetupPage && !isAdminPage) {
      let tenantId = memberData?.tenant_id as string | undefined;
      let tenantRole = memberData?.role as string | undefined;

      if (systemRole === 'super_admin') {
        const selectedTenantId = request.cookies.get(ACTIVE_TENANT_COOKIE)?.value;
        if (selectedTenantId) {
          const { data: selectedTenant, error: selectedTenantError } = await supabase
            .from('tenants')
            .select('id')
            .eq('id', selectedTenantId)
            .maybeSingle();

          if (selectedTenantError) {
            console.error('Failed to validate selected tenant:', selectedTenantError);
            return NextResponse.json(
              { error: 'Unable to validate the selected tenant' },
              { status: 503 }
            );
          } else if (selectedTenant) {
            tenantId = selectedTenant.id;
          }
        }

        if (!tenantId) {
          const { data: firstTenant, error: firstTenantError } = await supabase
            .from('tenants')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (firstTenantError) {
            console.error('Failed to resolve a default tenant for super admin:', firstTenantError);
            return NextResponse.json(
              { error: 'Unable to resolve a tenant for this dashboard' },
              { status: 503 }
            );
          } else {
            tenantId = firstTenant?.id;
          }
        }

        tenantRole = 'super_admin';
      }

      if (!tenantId) {
        if (systemRole === 'super_admin') {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
        return NextResponse.redirect(new URL('/setup', request.url));
      }

      requestHeaders.set('x-tenant-id', tenantId);
      requestHeaders.set('x-tenant-role', tenantRole ?? 'worker');
      requestHeaders.set('x-system-role', systemRole);

      const finalResponse = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      supabaseResponse.cookies.getAll().forEach((cookie) => {
        finalResponse.cookies.set(cookie.name, cookie.value);
      });

      supabaseResponse = finalResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/health (health check)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};