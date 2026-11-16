import { describe, expect, it } from 'vitest';
import { generateKey, normalizeKey } from '../src/services/AuthService';
import { ADMIN, TestServer } from './helpers';

const NEW = 'a-brand-new-pass-9';

describe('recovery key', () => {
  it('is shown once at setup and resets the password, then is replaced', async () => {
    const api = await TestServer.start({}, false);
    try {
      const created = await api.request('POST', '/api/setup', { email: 'a@neofit.test', password: 'long-enough-1' });
      expect(created.body.recoveryKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
      expect(created.body.hasRecoveryKey).toBe(true);
      const key: string = created.body.recoveryKey;

      // The key can be typed in lower case and without dashes.
      const typed = key.replaceAll('-', ' ').toLowerCase();
      const reset = await api.request('POST', '/api/reset-password', { email: 'A@neofit.test', recoveryKey: typed, newPassword: NEW });
      expect(reset.status).toBe(200);
      expect(reset.body.token).toBeTruthy();
      expect(reset.body.recoveryKey).not.toBe(key);

      expect((await api.request('POST', '/api/login', { email: 'a@neofit.test', password: 'long-enough-1' })).status).toBe(401);
      expect((await api.request('POST', '/api/login', { email: 'a@neofit.test', password: NEW })).status).toBe(200);

      // A used key is dead.
      const again = await api.request('POST', '/api/reset-password', { email: 'a@neofit.test', recoveryKey: key, newPassword: 'another-pass-77' });
      expect(again.status).toBe(401);
    } finally {
      await api.stop();
    }
  });

  it('refuses a wrong key, a short password and an unknown email the same way', async () => {
    const api = await TestServer.start({}, false);
    try {
      const created = await api.request('POST', '/api/setup', { email: 'a@neofit.test', password: 'long-enough-1' });
      const wrong = await api.request('POST', '/api/reset-password', { email: 'a@neofit.test', recoveryKey: 'AAAAA-AAAAA-AAAAA-AAAAA', newPassword: NEW });
      const unknown = await api.request('POST', '/api/reset-password', { email: 'who@neofit.test', recoveryKey: created.body.recoveryKey, newPassword: NEW });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.error).toBe(unknown.body.error);
      const short = await api.request('POST', '/api/reset-password', { email: 'a@neofit.test', recoveryKey: created.body.recoveryKey, newPassword: 'short' });
      expect(short.status).toBe(400);
      // The right key still works after the failures above (they are below the limit).
      expect((await api.request('POST', '/api/reset-password', { email: 'a@neofit.test', recoveryKey: created.body.recoveryKey, newPassword: NEW })).status).toBe(200);
    } finally {
      await api.stop();
    }
  });

  it('locks the reset after five wrong keys', async () => {
    const api = await TestServer.start({}, false);
    try {
      const created = await api.request('POST', '/api/setup', { email: 'a@neofit.test', password: 'long-enough-1' });
      for (let i = 0; i < 5; i += 1) {
        const r = await api.request('POST', '/api/reset-password', { email: 'a@neofit.test', recoveryKey: 'BBBBB-BBBBB-BBBBB-BBBBB', newPassword: NEW });
        expect(r.status).toBe(401);
      }
      const locked = await api.request('POST', '/api/reset-password', { email: 'a@neofit.test', recoveryKey: created.body.recoveryKey, newPassword: NEW });
      expect(locked.status).toBe(401);
      expect(locked.body.error).toMatch(/15 minutes/);
    } finally {
      await api.stop();
    }
  });

  it('lets an existing administrator make a key, which needs the password and replaces the old one', async () => {
    const api = await TestServer.start(); // seeded admin: made without a key
    try {
      const login = await api.request('POST', '/api/login', ADMIN);
      expect(login.body.hasRecoveryKey).toBe(false);
      expect((await api.request('POST', '/api/recovery-key', { password: ADMIN.password })).status).toBe(401); // no token

      const wrong = await api.request('POST', '/api/recovery-key', { password: 'not-the-password' }, login.body.token);
      expect(wrong.status).toBe(401);

      const first = await api.request('POST', '/api/recovery-key', { password: ADMIN.password }, login.body.token);
      expect(first.status).toBe(201);
      const second = await api.request('POST', '/api/recovery-key', { password: ADMIN.password }, login.body.token);
      expect(second.body.recoveryKey).not.toBe(first.body.recoveryKey);

      expect((await api.request('POST', '/api/login', ADMIN)).body.hasRecoveryKey).toBe(true);
      const old = await api.request('POST', '/api/reset-password', { email: ADMIN.email, recoveryKey: first.body.recoveryKey, newPassword: NEW });
      expect(old.status).toBe(401);
      const ok = await api.request('POST', '/api/reset-password', { email: ADMIN.email, recoveryKey: second.body.recoveryKey, newPassword: NEW });
      expect(ok.status).toBe(200);
    } finally {
      await api.stop();
    }
  });

  it('makes keys that are long, varied and normalised', () => {
    const keys = new Set(Array.from({ length: 50 }, generateKey));
    expect(keys.size).toBe(50);
    expect(normalizeKey('k7qm4-xt29r wdhc3_pvn8b')).toBe('K7QM4XT29RWDHC3PVN8B');
  });
});
