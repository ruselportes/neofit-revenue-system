import { describe, expect, it } from 'vitest';
import { ADMIN, TestServer } from './helpers';

const lifetimeSeconds = (token: string): number => {
  const p = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { iat: number; exp: number };
  return p.exp - p.iat;
};

describe('keeping the administrator signed in', () => {
  it('a normal login lasts the usual time; "keep me signed in" lasts 30 days', async () => {
    const api = await TestServer.start();
    try {
      const normal = await api.request('POST', '/api/login', ADMIN);
      const remembered = await api.request('POST', '/api/login', { ...ADMIN, remember: true });
      expect(lifetimeSeconds(normal.body.token)).toBe(3600); // the test server's 1 hour
      expect(lifetimeSeconds(remembered.body.token)).toBe(30 * 24 * 3600);
    } finally {
      await api.stop();
    }
  });

  it('opening the app with a saved login answers who it is and renews the token', async () => {
    const api = await TestServer.start();
    try {
      const saved = (await api.request('POST', '/api/login', { ...ADMIN, remember: true })).body.token as string;
      expect((await api.request('GET', '/api/session')).status).toBe(401); // no token, no session

      const renewed = await api.request('GET', '/api/session', undefined, saved);
      expect(renewed.status).toBe(200);
      expect(renewed.body).toMatchObject({ email: ADMIN.email, role: 'admin', hasRecoveryKey: false });
      expect(lifetimeSeconds(renewed.body.token)).toBe(30 * 24 * 3600); // still remembered, slid forward
      expect((await api.request('GET', '/api/members', undefined, renewed.body.token)).status).toBe(200);
    } finally {
      await api.stop();
    }
  });

  it('a renewed login that was not remembered stays short', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      const renewed = await api.request('GET', '/api/session', undefined, token);
      expect(lifetimeSeconds(renewed.body.token)).toBe(3600);
    } finally {
      await api.stop();
    }
  });

  it('Sign out ends every saved login, and signing in again works', async () => {
    const api = await TestServer.start();
    try {
      const a = (await api.request('POST', '/api/login', { ...ADMIN, remember: true })).body.token as string;
      const b = (await api.request('POST', '/api/login', ADMIN)).body.token as string;
      expect((await api.request('GET', '/api/members', undefined, a)).status).toBe(200);

      expect((await api.request('POST', '/api/logout', undefined, a)).status).toBe(204);
      expect((await api.request('GET', '/api/members', undefined, a)).status).toBe(401);
      expect((await api.request('GET', '/api/session', undefined, a)).status).toBe(401);
      expect((await api.request('GET', '/api/members', undefined, b)).status).toBe(401); // the other login too

      const again = await api.request('POST', '/api/login', ADMIN);
      expect((await api.request('GET', '/api/members', undefined, again.body.token)).status).toBe(200);
    } finally {
      await api.stop();
    }
  });

  it('a password reset with the recovery key ends a login that was saved before it', async () => {
    const api = await TestServer.start(undefined, false);
    try {
      const created = await api.request('POST', '/api/setup', { email: 'a@neofit.test', password: 'long-enough-1', remember: true });
      const saved = created.body.token as string;
      expect((await api.request('GET', '/api/members', undefined, saved)).status).toBe(200);

      const reset = await api.request('POST', '/api/reset-password', {
        email: 'a@neofit.test',
        recoveryKey: created.body.recoveryKey,
        newPassword: 'a-new-password-2',
        remember: true,
      });
      expect(reset.status).toBe(200);
      expect((await api.request('GET', '/api/members', undefined, saved)).status).toBe(401); // the old saved login is dead
      expect((await api.request('GET', '/api/members', undefined, reset.body.token)).status).toBe(200); // the new one works
    } finally {
      await api.stop();
    }
  });

  it('a login for an account that no longer exists is refused', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      api.container.database.connection.prepare('DELETE FROM users').run();
      expect((await api.request('GET', '/api/session', undefined, token)).status).toBe(401);
    } finally {
      await api.stop();
    }
  });
});
