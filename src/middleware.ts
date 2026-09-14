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
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Role-Based Routing for Authenticated Users
  if (user) {
    // 1. Redirect away from login if already authenticated
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Fetch user's system role
    const { data: userData } = await supabase
      .from('users')
      .select('system_role')
      .eq('id', user.id)
      .single();
      
    const systemRole = userData?.system_role || 'user';

    // 2. Super Admin Protection
    if (isAdminPage) {
      if (systemRole !== 'super_admin') {
        // Kick standard users out of the admin panel
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      // Allowed: super admin proceeding to /admin
    } 
    // 3. Client User / Tenant Protection (Dashboard Routes)
    else if (!isSetupPage) {
      // Fetch the user's tenant record
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!memberData) {
        // No tenant exists -> Redirect to onboarding/setup
        const url = request.nextUrl.clone();
        url.pathname = '/setup';
        return NextResponse.redirect(url);
      } else {
        // Inject tenant details into headers for Server Components
        requestHeaders.set('x-tenant-id', memberData.tenant_id);
        requestHeaders.set('x-tenant-role', memberData.role);
        
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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
