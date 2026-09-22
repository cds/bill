'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Activity, LogOut, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { href: '/admin', label: 'Overview', icon: Activity },
    { href: '/admin/tenants', label: 'Tenants', icon: Settings },
    { href: '/admin/users', label: 'Global Users', icon: Users },
    { href: '/admin/logs', label: 'Audit Logs', icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between mx-auto px-4 max-w-7xl">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center space-x-2">
            <span className="font-bold text-lg hidden sm:inline-block">Eatera Admin Control</span>
            <span className="font-bold text-lg sm:hidden">Admin</span>
          </Link>
          <nav className="hidden sm:flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80 flex items-center gap-2",
                  pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin') ? "text-foreground" : "text-foreground/60"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
           {/* Link to standard app to let admin use it normally */}
           <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:block">
             Exit to App
           </Link>
           <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground p-2">
             <LogOut className="w-5 h-5" />
           </button>
        </div>
      </div>
      {/* Mobile nav */}
      <div className="flex sm:hidden overflow-x-auto border-t px-4 py-2 gap-4 text-sm">
         {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap flex items-center gap-1.5",
                pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin') ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-3 h-3" />
              {item.label}
            </Link>
         ))}
      </div>
    </header>
  );
}
