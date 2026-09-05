import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Toaster } from 'sonner';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Bill — Eatera Foods',
  description: 'SME Accounting, Billing & Inventory for Eatera Foods',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16a34a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased bg-background text-foreground">
        <AppHeader />
        <main className="flex-1 pb-20 sm:pb-6">{children}</main>
        <BottomNav />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
