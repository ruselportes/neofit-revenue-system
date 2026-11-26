import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { MemberAccount, Profile } from '../src/cloud/types';
import { CODE_MAX_LENGTH, CODE_MIN_LENGTH, cleanCode, isCompleteCode, resendLabel, resendSecondsLeft } from '../src/memberCode';
import { AuthError, AuthService, type IdentityCache } from '../src/services/AuthService';

describe('the code the member types', () => {
  it('keeps only the digits, at most ten, so a pasted "1234 5678" works', () => {
    expect([CODE_MIN_LENGTH, CODE_MAX_LENGTH]).toEqual([6, 10]);
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('1234 5678')).toBe('12345678');
    expect(cleanCode('12-34-56-78-90-12')).toBe('1234567890');
    expect(cleanCode('abc')).toBe('');
    expect(cleanCode('12a3')).toBe('123');
  });
  it('is complete from six digits up, so six and eight digit codes both work', () => {
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('123456')).toBe(true);
    expect(isCompleteCode('1234 5678')).toBe(true);
  });
  it('counts down the wait before another code may be asked for', () => {
    expect(resendSecondsLeft(0, 0)).toBe(60);
    expect(resendSecondsLeft(0, 12_500)).toBe(48);
    expect(resendSecondsLeft(0, 60_000)).toBe(0);
    expect(resendSecondsLeft(0, 120_000)).toBe(0);
    expect(resendLabel(48)).toBe('Resend code in 48s');
    expect(resendLabel(0)).toBe('Resend code');
  });
});

const staff = { id: 'u1', fullName: 'Staff One', role: 'staff', isActive: true } as unknown as Profile;
const member = { id: 'm1', fullName: 'Rose', memberId: 'M-001' } as unknown as MemberAccount;

class MemoryCache implements IdentityCache {
  readonly data = new Map<string, string>();
  async getItem(k: string) { return this.data.get(k) ?? null; }
  async setItem(k: string, v: string) { this.data.set(k, v); }
  async removeItem(k: string) { this.data.delete(k); }
}

function build(verify: () => Promise<unknown>, opts: { profile?: Profile | null; otpError?: unknown } = {}) {
  const client = {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: opts.otpError ?? null })),
      verifyOtp: vi.fn(verify),
    },
  };
  const profiles = { get: vi.fn(async () => opts.profile ?? null) };
  const members = { accountForUser: vi.fn(async () => member) };
  const cache = new MemoryCache();
  const auth = new AuthService(client as never, profiles as never, members as never, undefined, cache);
  return { auth, client, cache };
}

const ok = async () => ({ data: { user: { id: 'm1' }, session: {} }, error: null });

describe('signing a member in with the code', () => {
  it('sends the code request without creating an account for an unknown email', async () => {
    const t = build(ok);
    await t.auth.requestMemberCode('  rose@example.com ');
    expect(t.client.auth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'rose@example.com', options: expect.objectContaining({ shouldCreateUser: false }) }));
  });

  it('shows a rate limit instead of pretending a code is on its way', async () => {
    const limited = build(ok, { otpError: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit') });
    await expect(limited.auth.requestMemberCode('rose@example.com')).rejects.toThrow('Too many codes were asked for. Wait a minute and try again.');
  });

  it('still says nothing about an address that has no account (so the screen reveals no one)', async () => {
    const unknown = build(ok, { otpError: new AuthApiError('Signups not allowed for otp', 422, 'otp_disabled') });
    await expect(unknown.auth.requestMemberCode('nobody@example.com')).resolves.toBeUndefined();
  });

  it('signs the member in with the right code and remembers them', async () => {
    const t = build(ok);
    await t.auth.verifyMemberCode(' rose@example.com ', '123 456');
    expect(t.client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'rose@example.com', token: '123456', type: 'email' });
    expect(t.auth.current().kind).toBe('member');
    // Who they are, and that a password still has to be created.
    expect([...t.cache.data.keys()].sort()).toEqual(['neofit_last_identity', 'neofit_password_pending']);
  });

  it('says so clearly for a wrong or expired code, and does not sign in', async () => {
    const t = build(async () => ({ data: { user: null, session: null }, error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired') }));
    await expect(t.auth.verifyMemberCode('rose@example.com', '000000')).rejects.toThrow('That code is wrong or has expired. Ask for a new one.');
    expect(t.auth.current().kind).not.toBe('member');
  });

  it('asks for all the digits before calling the server', async () => {
    const t = build(ok);
    await expect(t.auth.verifyMemberCode('rose@example.com', '123')).rejects.toThrow('Enter the full code from the email.');
    expect(t.client.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('tells a connection problem apart from a wrong code', async () => {
    const retryable = build(async () => ({ data: { user: null, session: null }, error: new AuthRetryableFetchError('fetch failed', 0) }));
    await expect(retryable.auth.verifyMemberCode('rose@example.com', '123456')).rejects.toThrow('Cannot reach the server. Check your connection and try again.');

    const thrown = build(() => Promise.reject(new TypeError('Network request failed')));
    await expect(thrown.auth.verifyMemberCode('rose@example.com', '123456')).rejects.toThrow('Cannot reach the server. Check your connection and try again.');
  });

  it('refuses a staff account that enters a member code, and signs it out', async () => {
    const t = build(ok, { profile: staff });
    await expect(t.auth.verifyMemberCode('staff@example.com', '123456')).rejects.toThrow(AuthError);
    expect(t.auth.current().kind).toBe('signedOut');
    expect(t.client.auth.signOut).toHaveBeenCalled();
  });
});
