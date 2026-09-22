'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, Users, ShoppingCart, LayoutDashboard, Receipt, LogOut, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';

export function AppHeader({ userRole }: { userRole?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      router.push('/login');
      router.refresh();
    }
  };

  const desktopNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/items', label: 'Items', icon: Package },
    { href: '/sales', label: 'Sales', icon: ShoppingCart },
    { href: '/parties', label: 'Parties', icon: Users },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/reports', label: 'Reports', icon: Receipt },
  ];
  
  // If tenant_admin, give them the admin links
  if (userRole === 'tenant_admin') {
    desktopNavItems.push({ href: '/team', label: 'Team', icon: Shield });
    desktopNavItems.push({ href: '/logs', label: 'Logs', icon: Shield });
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        <div className="flex items-center">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2 mr-4">
            <div className="rounded-lg bg-primary p-1.5">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg hidden sm:inline-block">
              Eatera Foods
            </span>
          </Link>

          {/* Role Badge */}
          {userRole && (
            <Badge variant={userRole === 'tenant_admin' ? 'default' : 'secondary'} className="hidden sm:inline-flex mr-6 capitalize text-xs">
              {userRole.replace('_', ' ')}
            </Badge>
          )}

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {desktopNavItems.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Brand (centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center sm:hidden">
          <span className="font-bold text-lg">Eatera Foods</span>
          {userRole && <span className="text-[10px] text-muted-foreground capitalize leading-none">{userRole.replace('_', ' ')}</span>}
        </div>

        {/* Logout Button */}
        <div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
            <LogOut className="w-5 h-5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </header>
  );
}
