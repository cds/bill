import type { Metadata } from 'next';
import { OfflineApp } from '@/components/pwa/offline-app';

export const metadata: Metadata = {
  title: 'Offline access | Bill',
  robots: { index: false, follow: false },
};

export default function OfflineAppPage() {
  return <OfflineApp />;
}
