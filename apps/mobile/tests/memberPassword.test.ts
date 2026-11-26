import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { MemberAccount, Profile } from '../src/cloud/types';
import { passwordProblem } from '../src/passwordRules';
import { AuthService, type IdentityCache } from '../src/services/AuthService';

const staff = { id: 'u1', fullName: 'Staff One', role: 'staff', isActive: true } as unknown as Profile;
const member = { id: 'a1', name: 'Rose', memberId: 'M-001', email: 'rose@example.com' } as unknown as MemberAccount;

class MemoryCache implements IdentityCache {
  readonly data = new Map<string, string>();
  async getItem(k: string) { return this.data.get(k) ?? null; }
  async setItem(k: string, v: string) { this.data.set(k, v); }
  async removeItem(k: string) { this.data.delete(k); }
}

const userWith = (metadata: Record<string, unknown>) => ({ id: 'm1', email: 'rose@example.com', user_metadata: metadata });

function build(opts: { metadata?: Record<string, unknown>; profile?: Profile | null; signInError?: unknown; updateErrors?: unknown[]; cache?: MemoryCache; saved?: boolean } = {}) {
  const user = userWith(opts.metadata ?? {});
  const updateErrors = [...(opts.updateErrors ?? [])];
  const client = {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: opts.saved ? { user } : null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => (opts.signInError ? { data: { user: null }, error: opts.signInError } : { data: { user }, error: null })),
      verifyOtp: vi.fn(async () => ({ data: { user }, error: null })),
      updateUser: vi.fn(async (_change: unknown) => {
        const error = updateErrors.shift() ?? null;
        return { data: { user: error ? null : user }, error };
      }),
    },
  };
  const profiles = { get: vi.fn(async () => opts.profile ?? null) };
  const members = { accountForUser: vi.fn(async () => member) };
  const cache = opts.cache ?? new MemoryCache();
  const auth = new AuthService(client as never, profiles as never, members as never, undefined, cache);
  return { auth, client, cache };
}

const needs = (auth: AuthService) => {
  const state = auth.current();
  return state.kind === 'member' ? state.needsPassword : undefined;
};

describe('the new password typed twice', () => {
  it('needs eight characters and the same text both times', () => {
    expect(passwordProblem('short', 'short')).toMatch('at least 8');
    expect(passwordProblem('long-enough-1', 'long-enough-2')).toBe('The two passwords are not the same.');
    expect(passwordProblem('long-enough-1', 'long-enough-1')).toBeNull();
  });
});

describe('a member signing in with a password', () => {
  it('goes straight in', async () => {
    const t = build();
    await t.auth.signInMember(' rose@example.com ', 'secret-pass');
    expect(t.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'rose@example.com', password: 'secret-pass' });
    expect(t.auth.current().kind).toBe('member');
    expect(needs(t.auth)).toBe(false);
  });

  it('gets one message for a wrong password or an unknown address', async () => {
    const t = build({ signInError: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') });
    await expect(t.auth.signInMember('nobody@example.com', 'x')).rejects.toThrow('Wrong email or password.');
  });

  it('is told about a connection problem instead of a wrong password', async () => {
    const t = build({ signInError: new AuthRetryableFetchError('fetch failed', 0) });
    await expect(t.auth.signInMember('rose@example.com', 'secret-pass')).rejects.toThrow('Cannot reach the server.');
  });

  it('takes a staff member who types their password here to the staff screens', async () => {
    const t = build({ profile: staff });
    await t.auth.signInMember('staff@example.com', 'secret-pass');
    expect(t.auth.current().kind).toBe('staff');
    expect(t.client.auth.signOut).not.toHaveBeenCalled();
  });

  it('still refuses a disabled staff account', async () => {
    const t = build({ profile: { ...staff, isActive: false } as Profile });
    await expect(t.auth.signInMember('staff@example.com', 'secret-pass')).rejects.toThrow('disabled');
    expect(t.auth.current().kind).toBe('signedOut');
  });
});

describe('creating the password after an email code', () => {
  it('is asked for even when the member already had one (forgot password)', async () => {
    const t = build({ metadata: { has_password: true } });
    await t.auth.verifyMemberCode('rose@example.com', '12345678');
    expect(needs(t.auth)).toBe(true);
  });

  it('is still asked for after the app is closed and opened again', async () => {
    const first = build({ metadata: { has_password: true } });
    await first.auth.verifyMemberCode('rose@example.com', '12345678');
    const again = build({ metadata: { has_password: true }, cache: first.cache, saved: true });
    await again.auth.start();
    expect(needs(again.auth)).toBe(true);
  });

  it('is asked of a signed-in member who never created one', async () => {
    const t = build({ saved: true });
    await t.auth.start();
    expect(needs(t.auth)).toBe(true);
  });

  it('is not asked of a signed-in member who has one', async () => {
    const t = build({ saved: true, metadata: { has_password: true } });
    await t.auth.start();
    expect(needs(t.auth)).toBe(false);
  });

  it('saves it, marks the account, and lets the member in', async () => {
    const t = build();
    await t.auth.verifyMemberCode('rose@example.com', '12345678');
    await t.auth.setMemberPassword('long-enough-1');
    expect(t.client.auth.updateUser).toHaveBeenCalledWith({ password: 'long-enough-1', data: { has_password: true } });
    expect(needs(t.auth)).toBe(false);
    expect(t.cache.data.has('neofit_password_pending')).toBe(false);
  });

  it('accepts the same password as before and still marks the account', async () => {
    const t = build({ updateErrors: [new AuthApiError('New password should be different', 422, 'same_password')] });
    await t.auth.verifyMemberCode('rose@example.com', '12345678');
    await t.auth.setMemberPassword('long-enough-1');
    expect(t.client.auth.updateUser).toHaveBeenLastCalledWith({ data: { has_password: true } });
    expect(needs(t.auth)).toBe(false);
  });

  it('explains a password the server finds too weak', async () => {
    const t = build({ updateErrors: [new AuthApiError('Password should contain...', 422, 'weak_password')] });
    await t.auth.verifyMemberCode('rose@example.com', '12345678');
    await expect(t.auth.setMemberPassword('long-enough-1')).rejects.toThrow('Choose a stronger password');
  });

  it('keeps asking when saving fails', async () => {
    const t = build({ updateErrors: [new AuthRetryableFetchError('fetch failed', 0)] });
    await t.auth.verifyMemberCode('rose@example.com', '12345678');
    await expect(t.auth.setMemberPassword('long-enough-1')).rejects.toThrow('Cannot reach the server.');
    expect(needs(t.auth)).toBe(true);
  });
});

describe('changing the password', () => {
  it('checks the current password first', async () => {
    const t = build({ saved: true, signInError: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') });
    await expect(t.auth.changeMemberPassword('wrong', 'long-enough-2')).rejects.toThrow('Your current password is wrong.');
    expect(t.client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('saves the new one when the current one is right', async () => {
    const t = build({ saved: true });
    await t.auth.changeMemberPassword('long-enough-1', 'long-enough-2');
    expect(t.client.auth.updateUser).toHaveBeenCalledWith({ password: 'long-enough-2', data: { has_password: true } });
  });
});
