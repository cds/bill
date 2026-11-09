import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bill — Eatera Foods',
    short_name: 'Bill',
    description: 'Billing and inventory workspace for Eatera Foods',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7faf7',
    theme_color: '#16a34a',
    icons: [
      {
        src: '/offline-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
