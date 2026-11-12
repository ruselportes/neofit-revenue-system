import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from '../src/config';
import { dateOfIso, entriesText, shiftDate, shortDate, timeText, todayText, weekdayShort } from '../src/format';
import { ChunkedSecureStorage, type SecureBackend } from '../src/platform/ChunkedStorage';
import { parseAuthUrl } from '../src/services/authLinks';

describe('parseConfig', () => {
  it('lists every missing setting', () => {
    expect(() => parseConfig({})).toThrow(ConfigError);
    try {
      parseConfig({});
    } catch (err) {
      expect((err as ConfigError).missing).toEqual(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
    }
  });
  it('trims, drops a trailing slash, and allows the Gemini key to be empty', () => {
    expect(parseConfig({ url: ' https://abc.supabase.co/ ', anonKey: ' key ' })).toEqual({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'key',
      geminiApiKey: '',
    });
  });
  it('refuses an address that is not encrypted, except for this computer or the Android emulator', () => {
    expect(() => parseConfig({ url: 'http://abc.supabase.co', anonKey: 'k' })).toThrow(/https/);
    expect(() => parseConfig({ url: 'http://10.0.2.2:54321', anonKey: 'k' })).not.toThrow();
    expect(() => parseConfig({ url: 'http://localhost:54321', anonKey: 'k' })).not.toThrow();
  });
});

describe('dates', () => {
  it('formats and shifts calendar days', () => {
    expect(todayText(new Date(2026, 10, 4))).toBe('2026-11-04');
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('writes short dates, times and weekdays', () => {
    expect(shortDate('2026-11-04')).toBe('Nov 4, 2026');
    expect(shortDate(null)).toBe('—');
    expect(weekdayShort('2026-11-04')).toBe('Wed');
    expect(timeText(new Date(2026, 10, 4, 0, 5).toISOString())).toBe('12:05 AM');
    expect(timeText(new Date(2026, 10, 4, 13, 30).toISOString())).toBe('1:30 PM');
    expect(timeText('nonsense')).toBe('—');
    expect(timeText(null)).toBe('—');
  });
  it('takes the local day of a date-time', () => {
    expect(dateOfIso(new Date(2026, 10, 4, 23, 30).toISOString())).toBe('2026-11-04');
  });
});

describe('parseAuthUrl', () => {
  it('reads the tokens after "#" (the way Supabase sends them)', () => {
    expect(parseAuthUrl('neofit://auth#access_token=abc&refresh_token=def&type=magiclink')).toEqual({ accessToken: 'abc', refreshToken: 'def' });
  });
  it('reads them after "?" too', () => {
    expect(parseAuthUrl('https://app.example.com/?access_token=a1&refresh_token=r1')).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });
  it('ignores addresses without both tokens', () => {
    expect(parseAuthUrl('neofit://home')).toBeNull();
    expect(parseAuthUrl('neofit://auth#access_token=abc')).toBeNull();
    expect(parseAuthUrl('')).toBeNull();
  });
});

class MemoryBackend implements SecureBackend {
  data = new Map<string, string>();
  maxValue = 2048;
  async getItemAsync(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItemAsync(k: string, v: string) {
    if (v.length > this.maxValue) throw new Error('Value is too large for Secure Store.');
    if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error(`Invalid key: ${k}`);
    this.data.set(k, v);
  }
  async deleteItemAsync(k: string) {
    this.data.delete(k);
  }
}

describe('ChunkedSecureStorage', () => {
  const session = JSON.stringify({ access_token: 'x'.repeat(1500), refresh_token: 'y'.repeat(200), user: { id: 'u', email: 'a@b.co', meta: 'z'.repeat(3000) } });

  it('stores a value larger than Secure Store allows, and reads it back', async () => {
    const backend = new MemoryBackend();
    const store = new ChunkedSecureStorage(backend);
    await store.setItem('sb-abc-auth-token', session);
    expect(session.length).toBeGreaterThan(backend.maxValue);
    expect(await store.getItem('sb-abc-auth-token')).toBe(session);
  });
  it('uses only characters that Secure Store accepts in a key', async () => {
    const backend = new MemoryBackend();
    await new ChunkedSecureStorage(backend).setItem('key with spaces/and:colons', 'v');
    expect([...backend.data.keys()].every((k) => /^[A-Za-z0-9._-]+$/.test(k))).toBe(true);
  });
  it('removes old pieces when a shorter value replaces a longer one', async () => {
    const backend = new MemoryBackend();
    const store = new ChunkedSecureStorage(backend);
    await store.setItem('k', session);
    await store.setItem('k', 'short');
    expect(await store.getItem('k')).toBe('short');
    expect(backend.data.size).toBe(2); // one piece and the count
  });
  it('removes everything', async () => {
    const backend = new MemoryBackend();
    const store = new ChunkedSecureStorage(backend);
    await store.setItem('k', session);
    await store.removeItem('k');
    expect(backend.data.size).toBe(0);
    expect(await store.getItem('k')).toBeNull();
  });
  it('treats a missing piece as no session, never a damaged one', async () => {
    const backend = new MemoryBackend();
    const store = new ChunkedSecureStorage(backend);
    await store.setItem('k', session);
    backend.data.delete('k.1');
    expect(await store.getItem('k')).toBeNull();
  });
  it('returns null when nothing was stored', async () => {
    expect(await new ChunkedSecureStorage(new MemoryBackend()).getItem('nope')).toBeNull();
  });
});

describe('entriesText', () => {
  it('says entry for one and entries otherwise', () => {
    expect([entriesText(0), entriesText(1), entriesText(3)]).toEqual(['0 entries', '1 entry', '3 entries']);
  });
});
