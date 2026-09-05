'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Users, ShoppingCart, LayoutDashboard, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const desktopNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/items', label: 'Items', icon: Package },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/parties', label: 'Parties', icon: Users },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      <div className="flex items-center h-14 px-4 sm:px-6">
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-2 mr-6">
          <div className="rounded-lg bg-primary p-1.5">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:inline-block">
            Eatera Foods
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
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

        {/* Mobile Brand (centered) */}
        <div className="flex-1 text-center sm:hidden">
          <span className="font-bold text-lg">Eatera Foods</span>
        </div>
      </div>
    </header>
  );
}
