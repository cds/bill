const CACHE_NAME = 'bill-app-shell-v4';
const SHELL_ASSETS = [
  '/offline.html',
  '/offline-shell.css',
  '/offline-shell.js',
  '/offline-icon.svg',
  '/manifest.webmanifest',
];

async function cacheAppShell(cache) {
  // Cache the root dashboard shell and its static assets for offline boot.
  const response = await fetch('/');
  if (!response.ok) {
    throw new Error(`Failed to cache the app shell (${response.status}).`);
  }

  const html = await response.text();
  await cache.put('/', new Response(html, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'text/html; charset=utf-8',
    },
  }));
  await cache.put('/index.html', new Response(html, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'text/html; charset=utf-8',
    },
  }));

  const pending = new Set();
  const cached = new Set();
  const addAsset = (reference, baseUrl) => {
    try {
      const url = new URL(reference, baseUrl);
      if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
        pending.add(url.href);
      }
    } catch {
      // ignore
    }
  };

  for (const match of html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)) {
    addAsset(match[1], self.location.origin);
  }

  while (pending.size) {
    const batch = [...pending].filter((url) => !cached.has(url));
    pending.clear();
    await Promise.all(batch.map(async (url) => {
      cached.add(url);
      if (await cache.match(url)) return;

      const assetResponse = await fetch(url);
      if (!assetResponse.ok) {
        throw new Error(`Failed to cache an app shell asset (${assetResponse.status}).`);
      }

      const assetCopy = assetResponse.clone();
      await cache.put(url, assetCopy);
      const contentType = assetResponse.headers.get('content-type') ?? '';

      if (contentType.includes('javascript')) {
        const content = await assetResponse.text();
        for (const match of content.matchAll(/["'](\/_next\/static\/[^"']+)["']/g)) {
          addAsset(match[1], url);
        }
      } else if (contentType.includes('text/css')) {
        const content = await assetResponse.text();
        for (const match of content.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/g)) {
          addAsset(match[1], url);
        }
      }
    }));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(SHELL_ASSETS);
        try {
          await cacheAppShell(cache);
        } catch (error) {
          console.error('Failed to precache app shell:', error);
        }
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('bill-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    const navigationResponse = fetch(request);
    event.waitUntil(
      navigationResponse
        .then(async (response) => {
          if (!response.ok) return;
          const cache = await caches.open(CACHE_NAME);
          try {
            await cache.put(request, response.clone());
          } catch {
            // ignore
          }
          try {
            await cacheAppShell(cache);
          } catch (error) {
            console.error('Failed to refresh app shell cache:', error);
          }
        })
        .catch(() => {}),
    );
    event.respondWith(
      navigationResponse.catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match(request, { ignoreSearch: true })
          || await cache.match(requestUrl.pathname, { ignoreSearch: true })
          || await cache.match('/')
          || await cache.match('/index.html')
          || await caches.match('/offline.html');
        if (!shell) {
          throw new Error('Offline shell is not available in the service worker cache.');
        }
        return shell;
      }),
    );
    return;
  }

  if (requestUrl.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          await cache.put(request, response.clone());
        }
        return response;
      }),
    );
  }
});
