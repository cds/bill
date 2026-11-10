import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const origin = 'https://bill.test';
const serviceWorkerSource = readFileSync(
  new URL('../../public/sw.js', import.meta.url),
  'utf8',
);

function createServiceWorkerHarness() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const entries = new Map<string, Response>();
  let online = true;

  function cacheKey(input: string | Request) {
    return new URL(typeof input === 'string' ? input : input.url, origin);
  }

  const cache = {
    addAll: vi.fn(async (urls: string[]) => {
      for (const url of urls) {
        entries.set(cacheKey(url).href, new Response('cached shell asset'));
      }
    }),
    put: vi.fn(async (input: string | Request, response: Response) => {
      entries.set(cacheKey(input).href, response);
    }),
    match: vi.fn(async (
      input: string | Request,
      options?: { ignoreSearch?: boolean },
    ) => {
      const requested = cacheKey(input);
      if (options?.ignoreSearch) {
        for (const [key, response] of entries) {
          if (new URL(key).pathname === requested.pathname) return response;
        }
        return undefined;
      }
      return entries.get(requested.href);
    }),
  };
  const caches = {
    open: vi.fn(async () => cache),
    match: (input: string | Request) => cache.match(input),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async (input: string | Request) => {
    if (!online) throw new TypeError('Network unavailable');
    const url = cacheKey(input);
    if (url.pathname === '/offline-app') {
      return new Response(
        '<html><script src="/_next/static/chunks/offline-app.js"></script><link href="/_next/static/chunks/offline-app.css"></html>',
        { headers: { 'Content-Type': 'text/html', Vary: 'RSC, Accept', 'Set-Cookie': 'private=value' } },
      );
    }
    if (url.pathname.endsWith('.js')) {
      return new Response(
        'const worker = "/_next/static/media/powersync-worker.js"; const wasm = "/_next/static/media/database.wasm";',
        { headers: { 'Content-Type': 'text/javascript' } },
      );
    }
    if (url.pathname.endsWith('.css')) {
      return new Response(
        'body { background-image: url("/_next/static/media/font.woff2"); }',
        { headers: { 'Content-Type': 'text/css' } },
      );
    }
    return new Response('cached app asset');
  });

  const self = {
    location: { origin },
    addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => {
      listeners.set(type, listener);
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };

  runInNewContext(serviceWorkerSource, { self, caches, fetch, URL, Response, Promise, Set });

  return {
    cache,
    entries,
    fetch,
    listeners,
    setOnline(value: boolean) {
      online = value;
    },
  };
}

describe('offline service worker entry', () => {
  let harness: ReturnType<typeof createServiceWorkerHarness>;

  beforeEach(() => {
    harness = createServiceWorkerHarness();
  });

  it('pre-caches only the data-free offline app document and its static assets', async () => {
    let installPromise: Promise<void> | undefined;
    harness.listeners.get('install')?.({
      waitUntil(promise: Promise<void>) {
        installPromise = promise;
      },
    });

    await installPromise;

    expect(harness.entries.has(`${origin}/offline-app`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/chunks/offline-app.js`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/chunks/offline-app.css`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/media/powersync-worker.js`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/media/database.wasm`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/media/font.woff2`)).toBe(true);
    expect(harness.entries.get(`${origin}/offline-app`)?.headers.get('vary')).toBeNull();
    expect(harness.entries.get(`${origin}/offline-app`)?.headers.get('set-cookie')).toBeNull();
    expect(harness.fetch).toHaveBeenCalledWith('/offline-app');
  });

  it('redirects failed navigations to the cached app and does not preserve query strings', async () => {
    let installPromise: Promise<void> | undefined;
    harness.listeners.get('install')?.({
      waitUntil(promise: Promise<void>) {
        installPromise = promise;
      },
    });
    await installPromise;
    harness.setOnline(false);

    let responsePromise: Promise<Response> | undefined;
    harness.listeners.get('fetch')?.({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: `${origin}/sales/new?token=private`,
      },
      respondWith(promise: Promise<Response>) {
        responsePromise = promise;
      },
    });

    const redirect = await responsePromise;
    const location = new URL(redirect?.headers.get('location') ?? '');
    expect(redirect?.status).toBe(302);
    expect(location.pathname).toBe('/offline-app');
    expect(location.searchParams.get('requested')).toBe('/sales/new');
    expect(location.search).not.toContain('private');

    responsePromise = undefined;
    harness.listeners.get('fetch')?.({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: `${origin}/offline-app?requested=%2Fsales%2Fnew`,
      },
      respondWith(promise: Promise<Response>) {
        responsePromise = promise;
      },
    });
    const offlineAppResponse = await responsePromise;
    expect(await offlineAppResponse?.text()).toContain('offline-app.js');
  });
});
