import { AuthRetryableFetchError, AuthApiError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { MemberAccount, Profile } from '../src/cloud/types';
import { AuthService, type IdentityCache } from '../src/services/AuthService';

const staff = { id: 'u1', fullName: 'Staff One', role: 'staff', isActive: true } as unknown as Profile;
const member = { id: 'm1', fullName: 'Rose' } as unknown as MemberAccount;
const session = { user: { id: 'u1' } };

class MemoryCache implements IdentityCache {
  readonly data = new Map<string, string>();
  async getItem(k: string) { return this.data.get(k) ?? null; }
  async setItem(k: string, v: string) { this.data.set(k, v); }
  async removeItem(k: string) { this.data.delete(k); }
}

/** An AuthService over a fake Supabase client: `getSession` and the profile lookup answer as the test says. */
function build(opts: { session?: unknown; sessionError?: unknown; profile?: () => Promise<Profile | null>; account?: () => Promise<MemberAccount | null>; cache?: MemoryCache }) {
  const client = {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: opts.session ?? null }, error: opts.sessionError ?? null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
  const profiles = { get: vi.fn(opts.profile ?? (async () => staff)) };
  const members = { accountForUser: vi.fn(opts.account ?? (async () => null)) };
  const cache = opts.cache ?? new MemoryCache();
  const auth = new AuthService(client as never, profiles as never, members as never, undefined, cache);
  return { auth, client, profiles, members, cache };
}

const noSignal = () => Promise.reject(new TypeError('Network request failed'));

describe('staying signed in when the app is closed and opened again', () => {
  it('opens on the saved session and remembers who it is', async () => {
    const t = build({ session });
    await t.auth.start();
    expect(t.auth.current().kind).toBe('staff');
    expect(t.auth.isOffline()).toBe(false);
    expect(t.cache.data.size).toBe(1);
  });

  it('does not sign out when the phone has no signal at launch (the login is still saved)', async () => {
    const cache = new MemoryCache();
    await build({ session, cache }).auth.start(); // an earlier launch, online

    const offline = build({ session, profile: noSignal, cache }); // opened again with no signal
    await offline.auth.start();
    expect(offline.auth.current().kind).toBe('staff');
    expect(offline.auth.isOffline()).toBe(true);
  });

  it('does not sign out when the login cannot be renewed because there is no signal', async () => {
    const cache = new MemoryCache();
    await build({ session, cache }).auth.start();

    const t = build({ session: null, sessionError: new AuthRetryableFetchError('fetch failed', 0), cache });
    await t.auth.start();
    expect(t.auth.current().kind).toBe('staff');
    expect(t.auth.isOffline()).toBe(true);
  });

  it('confirms the person once the connection is back', async () => {
    const cache = new MemoryCache();
    await build({ session, cache }).auth.start();
    let online = false;
    const t = build({ session, cache, profile: async () => (online ? staff : Promise.reject(new TypeError('Network request failed'))) });
    await t.auth.start();
    expect(t.auth.isOffline()).toBe(true);

    online = true;
    await t.auth.revalidate();
    expect(t.auth.isOffline()).toBe(false);
    expect(t.auth.current().kind).toBe('staff');
  });

  it('remembers a member as a member', async () => {
    const cache = new MemoryCache();
    await build({ session, cache, profile: async () => null, account: async () => member }).auth.start();
    const t = build({ session, cache, profile: noSignal });
    await t.auth.start();
    expect(t.auth.current()).toMatchObject({ kind: 'member' });
  });
});

describe('when the person really has to sign in again', () => {
  it('goes to the sign-in screen when nobody was ever signed in', async () => {
    const t = build({});
    await t.auth.start();
    expect(t.auth.current().kind).toBe('signedOut');
  });

  it('goes to the sign-in screen with no signal and no one remembered', async () => {
    const t = build({ session, profile: noSignal });
    await t.auth.start();
    expect(t.auth.current().kind).toBe('signedOut');
  });

  it('signs out when the saved login is refused (not a connection problem) and forgets the person', async () => {
    const cache = new MemoryCache();
    await build({ session, cache }).auth.start();
    const t = build({ session: null, sessionError: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'), cache });
    await t.auth.start();
    expect(t.auth.current().kind).toBe('signedOut');
    expect(cache.data.size).toBe(0);
  });

  it('signs out a disabled account at once and forgets it', async () => {
    const cache = new MemoryCache();
    await build({ session, cache }).auth.start();
    const t = build({ session, cache, profile: async () => ({ ...staff, isActive: false }) });
    await t.auth.start();
    expect(t.auth.current().kind).toBe('signedOut');
    expect(cache.data.size).toBe(0);
  });

  it('signs out an account that has no access, and forgets it', async () => {
    const cache = new MemoryCache();
    await build({ session, cache }).auth.start();
    const t = build({ session, cache, profile: async () => null, account: async () => null });
    await t.auth.start();
    expect(t.auth.current().kind).toBe('signedOut');
    expect(cache.data.size).toBe(0);
  });

  it('Sign out clears what was remembered', async () => {
    const t = build({ session });
    await t.auth.start();
    await t.auth.signOut();
    expect(t.auth.current().kind).toBe('signedOut');
    expect(t.cache.data.size).toBe(0);
  });
});
