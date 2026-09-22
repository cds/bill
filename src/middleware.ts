import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  
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
    // Fetch system_role from the public.users table
    const { data: userData } = await supabase
      .from('users')
      .select('system_role')
      .eq('id', user.id)
      .single();
    
    const systemRole = userData?.system_role || 'user';

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
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!memberData) {
        // If a super_admin has no tenant but tries to access the dashboard (/), redirect to /admin instead of setup
        if (systemRole === 'super_admin' && pathname === '/') {
          return NextResponse.redirect(new URL('/admin', request.url));
        }

        // Otherwise redirect to onboarding/setup
        return NextResponse.redirect(new URL('/setup', request.url));
      } else {
        // Inject tenant details into headers for Server Components
        requestHeaders.set('x-tenant-id', memberData.tenant_id);
        requestHeaders.set('x-tenant-role', memberData.role);
        requestHeaders.set('x-system-role', systemRole);
        
        // Re-instantiate the response so Next.js sees the new request headers
        const finalResponse = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        
        // Preserve any session cookies that Supabase might have just refreshed
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          finalResponse.cookies.set(cookie.name, cookie.value);
        });
        
        supabaseResponse = finalResponse;
      }
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