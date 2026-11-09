import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { SupabasePowerSyncConnector } from '@/lib/powersync/connector';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

const mockCreateClient = vi.mocked(createClient);

function makeSession(expiresAt: number, accessToken = 'supabase-access-token') {
  return {
    access_token: accessToken,
    expires_at: expiresAt,
    user: { id: 'test-user-id' },
  };
}

function setupAuth(options: {
  session: ReturnType<typeof makeSession> | null;
  refreshedSession?: ReturnType<typeof makeSession> | null;
  sessionError?: Error | null;
  refreshError?: Error | null;
}) {
  const getSession = vi.fn().mockResolvedValue({
    data: { session: options.session },
    error: options.sessionError ?? null,
  });
  const refreshSession = vi.fn().mockResolvedValue({
    data: { session: options.refreshedSession ?? null },
    error: options.refreshError ?? null,
  });

  mockCreateClient.mockReturnValue({
    auth: { getSession, refreshSession },
  } as unknown as ReturnType<typeof createClient>);

  return { getSession, refreshSession };
}

describe('SupabasePowerSyncConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_POWERSYNC_URL = 'https://test.powersync.example';
  });

  it('returns credentials for a valid current Supabase session', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const { refreshSession } = setupAuth({ session: makeSession(expiresAt) });

    const credentials = await new SupabasePowerSyncConnector().fetchCredentials();

    expect(credentials).toEqual({
      endpoint: 'https://test.powersync.example',
      token: 'supabase-access-token',
      expiresAt: new Date(expiresAt * 1000),
    });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('returns null when the user has no Supabase session', async () => {
    const { refreshSession } = setupAuth({ session: null });

    await expect(new SupabasePowerSyncConnector().fetchCredentials()).resolves.toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes an expired or expiring session before returning credentials', async () => {
    const expiringSession = makeSession(Math.floor(Date.now() / 1000) + 30);
    const refreshedExpiry = Math.floor(Date.now() / 1000) + 3600;
    const { refreshSession } = setupAuth({
      session: expiringSession,
      refreshedSession: makeSession(refreshedExpiry, 'refreshed-access-token'),
    });

    const credentials = await new SupabasePowerSyncConnector().fetchCredentials();

    expect(refreshSession).toHaveBeenCalledOnce();
    expect(credentials).toEqual({
      endpoint: 'https://test.powersync.example',
      token: 'refreshed-access-token',
      expiresAt: new Date(refreshedExpiry * 1000),
    });
  });

  it('throws when the expiring session cannot be refreshed', async () => {
    setupAuth({
      session: makeSession(Math.floor(Date.now() / 1000) - 1),
    });

    await expect(new SupabasePowerSyncConnector().fetchCredentials())
      .rejects.toThrow('The Supabase session expired and could not be refreshed.');
  });

  it('surfaces Supabase session lookup and refresh errors', async () => {
    setupAuth({
      session: null,
      sessionError: new Error('session lookup failed'),
    });
    await expect(new SupabasePowerSyncConnector().fetchCredentials())
      .rejects.toThrow('Failed to retrieve the Supabase session: session lookup failed');

    setupAuth({
      session: makeSession(Math.floor(Date.now() / 1000)),
      refreshError: new Error('refresh failed'),
    });
    await expect(new SupabasePowerSyncConnector().fetchCredentials())
      .rejects.toThrow('Failed to refresh the Supabase session: refresh failed');
  });
});
