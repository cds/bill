'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, PlusCircle, Users, Menu, ShoppingCart, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/items', label: 'Items', icon: Package },
  { href: '/sales/new', label: 'Sale', icon: PlusCircle, isCenter: true },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/parties', label: 'Parties', icon: Users },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden print:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="rounded-full bg-primary p-3 shadow-lg shadow-primary/25">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-[10px] font-medium mt-1 text-primary">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-1 px-3 min-w-[60px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
