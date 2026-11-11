import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceWorkerSource = readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
const origin = 'https://bill.example';

function normalizeUrl(url: string) {
  return url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function createServiceWorkerHarness() {
  const entries = new Map<string, Response>();
  const cache = {
    addAll: vi.fn(async (urls: string[]) => {
      for (const url of urls) {
        entries.set(normalizeUrl(url), new Response(url));
      }
    }),
    put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      entries.set(normalizeUrl(url), response);
    }),
    match: vi.fn(async (request: RequestInfo | URL, options?: { ignoreSearch?: boolean }) => {
      const url = normalizeUrl(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url);
      if (entries.has(url)) return entries.get(url)!.clone();
      if (options?.ignoreSearch) {
        const pathname = new URL(url).pathname;
        for (const [key, value] of entries.entries()) {
          try {
            if (new URL(key).pathname === pathname) return value.clone();
          } catch {
            // ignore
          }
        }
      }
      return undefined;
    }),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ['bill-app-shell-v4']),
    delete: vi.fn(async () => true),
    match: vi.fn(async (request: RequestInfo | URL) => cache.match(request)),
  };
  const listeners = new Map<string, (event: any) => void>();
  let installFetch: typeof fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === '/' || url === `${origin}/`) {
      return new Response('<html><head><script src="/_next/static/chunks/app.js"></script><link href="/_next/static/chunks/app.css"></head></html>', { headers: { 'Content-Type': 'text/html' } });
    }
    return new Response(url, { headers: { 'Content-Type': 'application/javascript' } });
  }) as unknown as typeof fetch;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => installFetch(input, init));

  const context = {
    Response,
    URL,
    Set,
    Promise,
    console,
    caches,
    fetch: fetchMock,
    location: new URL(`${origin}/sw.js`),
    self: {
      location: new URL(`${origin}/sw.js`),
      skipWaiting: vi.fn(async () => undefined),
      clients: { claim: vi.fn(async () => undefined) },
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener as never),
    },
  };

  vm.runInNewContext(serviceWorkerSource, context, { filename: 'sw.js' });
  return { cache, caches, fetch: fetchMock, listeners, entries, setFetch: (next: typeof fetch) => { installFetch = next; } };
}

async function runInstall(listeners: Map<string, Function>) {
  let installPromise = Promise.resolve();
  listeners.get('install')?.({ waitUntil: (promise: Promise<unknown>) => { installPromise = promise; } });
  await installPromise;
}

describe('offline service worker shell', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('pre-caches root app shell and its static assets', async () => {
    const harness = createServiceWorkerHarness();
    await runInstall(harness.listeners);

    expect(harness.entries.has(`${origin}/`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/chunks/app.js`)).toBe(true);
    expect(harness.entries.has(`${origin}/_next/static/chunks/app.css`)).toBe(true);
    expect(harness.entries.has(`${origin}/offline.html`)).toBe(true);
  });

  it('serves cached shell for failed navigations without redirecting to /offline-app', async () => {
    const harness = createServiceWorkerHarness();
    await runInstall(harness.listeners);

    harness.setFetch(vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch);

    let responsePromise: Promise<Response> | undefined;
    harness.listeners.get('fetch')?.({
      request: { url: `${origin}/parties`, method: 'GET', mode: 'navigate' },
      respondWith: (promise: Promise<Response>) => { responsePromise = promise; },
      waitUntil: () => {},
    });

    const response = await responsePromise;
    expect(response).toBeDefined();
    expect(response?.status).toBe(200);
    expect(await response?.text()).toContain('/_next/static/chunks/app.js');
  });

  it('refreshes cached shell after a successful online navigation', async () => {
    const harness = createServiceWorkerHarness();
    await runInstall(harness.listeners);

    harness.setFetch(vi.fn(async () => new Response(
      '<html><script src="/_next/static/chunks/app-v2.js"></script></html>',
      { headers: { 'Content-Type': 'text/html' }, status: 200 },
    )) as unknown as typeof fetch);

    let responsePromise: Promise<Response> | undefined;
    let waitPromise = Promise.resolve();
    harness.listeners.get('fetch')?.({
      request: { url: `${origin}/parties`, method: 'GET', mode: 'navigate' },
      respondWith: (promise: Promise<Response>) => { responsePromise = promise; },
      waitUntil: (promise: Promise<unknown>) => { waitPromise = promise; },
    });

    await responsePromise;
    await waitPromise;

    expect(await harness.entries.get(`${origin}/`)?.text()).toContain('app-v2.js');
    expect(harness.entries.has(`${origin}/_next/static/chunks/app-v2.js`)).toBe(true);
  });
});
