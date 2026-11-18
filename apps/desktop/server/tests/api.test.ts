import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Money, LogbookEntry } from '@neofit/core';
import jwt from 'jsonwebtoken';
import { ServerConfig } from '../src/config/ServerConfig';
import { MemberStatusPolicy } from '../src/services/MemberStatusPolicy';
import { ADMIN, TestServer } from './helpers';

describe('ServerConfig', () => {
  const ok = { jwtSecret: 'x'.repeat(32), dbPath: 'a.db', port: 3001, tokenTtl: '24h', corsOrigins: [] };
  it('has no built-in secrets', () => {
    expect(() => ServerConfig.fromEnv({})).toThrow(/JWT_SECRET/);
    expect(() => ServerConfig.from({ ...ok, jwtSecret: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => ServerConfig.from({ ...ok, dbPath: '' })).toThrow(/DB_PATH/);
  });
  it('requires the admin email and password together, and a usable password', () => {
    expect(() => ServerConfig.from({ ...ok, adminEmail: 'a@b.co' })).toThrow(/together/);
    expect(() => ServerConfig.from({ ...ok, adminEmail: 'a@b.co', adminPassword: 'short' })).toThrow(/8 characters/);
  });
  it('listens only on the loopback address', () => {
    expect(ServerConfig.from(ok).host).toBe('127.0.0.1');
  });
});

describe('MemberStatusPolicy (Table 23.0)', () => {
  const today = '2026-11-04';
  it.each([
    ['2026-11-10', '2026-12-10', 'Pending'],
    ['2026-10-01', '2026-11-03', 'Expired'],
    ['2026-10-01', '2026-11-04', 'Expiring Soon'],
    ['2026-10-01', '2026-11-11', 'Expiring Soon'],
    ['2026-10-01', '2026-11-12', 'Active'],
  ])('joined %s, expires %s -> %s', (joined, expiry, expected) => {
    expect(MemberStatusPolicy.statusFor(joined, expiry, today)).toBe(expected);
  });
});

describe('local API', () => {
  let api: TestServer;
  let token: string;

  beforeAll(async () => {
    api = await TestServer.start();
    token = await api.login();
  });
  afterAll(() => api.stop());

  const newMember = (over: object = {}) => ({
    name: 'Rose Garcia',
    contact: '09171234567',
    plan: 'Regular Plan - Monthly (No Treadmill)',
    ...over,
  });

  describe('sign-in and protection', () => {
    it('answers the health check without a token', async () => {
      expect((await api.request('GET', '/api/health')).body).toEqual({ status: 'ok' });
    });
    it('refuses protected routes without a valid token', async () => {
      expect((await api.request('GET', '/api/members')).status).toBe(401);
      expect((await api.request('GET', '/api/members', undefined, 'garbage')).status).toBe(401);
    });
    it('refuses a token signed with another secret', async () => {
      const forged = jwt.sign({ sub: '1', email: ADMIN.email, role: 'admin' }, 'another-secret-another-secret-1234');
      expect((await api.request('GET', '/api/members', undefined, forged)).status).toBe(401);
    });
    it('refuses a wrong password and an unknown email with the same message', async () => {
      const wrong = await api.request('POST', '/api/login', { email: ADMIN.email, password: 'nope-nope-nope' });
      const unknown = await api.request('POST', '/api/login', { email: 'who@neofit.test', password: 'nope-nope-nope' });
      expect([wrong.status, unknown.status]).toEqual([401, 401]);
      expect(wrong.body.error).toBe(unknown.body.error);
    });
    it('rejects malformed JSON with 400', async () => {
      expect((await api.request('POST', '/api/login', '{bad', undefined)).status).toBe(400);
    });
    it('never returns a password hash', async () => {
      const res = await api.request('POST', '/api/login', ADMIN);
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    });
  });

  describe('members and payments', () => {
    it('adds a member with the next ID, the first payment and a receipt number', async () => {
      const res = await api.request('POST', '/api/members', newMember(), token);
      expect(res.status).toBe(201);
      expect(res.body.member).toMatchObject({
        memberId: 'M-001',
        status: 'Active',
        joinedDate: '2026-11-04',
        expiryDate: '2026-12-03',
        plan: 'Regular Plan - Monthly (No Treadmill)',
      });
      expect(res.body.payment).toMatchObject({ amount: 700, receiptNo: '2026-1104-01', periodEnd: '2026-12-03' });
    });

    it('numbers the next member and the next receipt of the day', async () => {
      const res = await api.request(
        'POST',
        '/api/members',
        newMember({ name: 'Ian', plan: 'Student Plan - Semi-Monthly (With Treadmill)' }),
        token,
      );
      expect(res.body.member.memberId).toBe('M-002');
      expect(res.body.payment).toMatchObject({ amount: 400, receiptNo: '2026-1104-02', periodEnd: '2026-11-18' });
    });

    it('uses the amount actually paid when it differs from the rate', async () => {
      const res = await api.request('POST', '/api/members', newMember({ name: 'Ann', amount: 650 }), token);
      expect(res.body.payment.amount).toBe(650);
    });

    it('rejects bad input and saves nothing', async () => {
      const before = (await api.request('GET', '/api/members', undefined, token)).body.length;
      expect((await api.request('POST', '/api/members', { ...newMember(), name: '' }, token)).status).toBe(400);
      expect((await api.request('POST', '/api/members', newMember({ email: 'not-an-email' }), token)).status).toBe(400);
      expect((await api.request('POST', '/api/members', newMember({ amount: -5 }), token)).status).toBe(400);
      expect((await api.request('GET', '/api/members', undefined, token)).body).toHaveLength(before);
    });

    it('renews from the day after the current period ends', async () => {
      const res = await api.request('POST', '/api/members/1/renew', {}, token);
      expect(res.body.payment).toMatchObject({ periodStart: '2026-12-04', periodEnd: '2027-01-03', receiptNo: '2026-1104-04' });
      expect(res.body.member.expiryDate).toBe('2027-01-03');
    });

    it('lists the payments of a member, newest first', async () => {
      const res = await api.request('GET', '/api/members/1/payments', undefined, token);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].periodStart).toBe('2026-12-04');
    });

    it('edits details without touching the payment history', async () => {
      const res = await api.request('PUT', '/api/members/1', { contact: '09990000000', email: 'rose@example.com' }, token);
      expect(res.body).toMatchObject({ contact: '09990000000', email: 'rose@example.com', name: 'Rose Garcia' });
    });

    it('returns 404 for an unknown member and 400 for a bad id', async () => {
      expect((await api.request('GET', '/api/members/999', undefined, token)).status).toBe(404);
      expect((await api.request('GET', '/api/members/abc', undefined, token)).status).toBe(400);
    });

    it('brings the status up to date when the clock moves', async () => {
      api.clock.date = new Date(2026, 11, 1, 9, 0, 0);
      const ian = (await api.request('GET', '/api/members/2', undefined, token)).body;
      expect(ian.status).toBe('Expired');
      const summary = (await api.request('GET', '/api/members/summary', undefined, token)).body;
      expect(summary.total).toBe(summary.active + summary.expiringSoon + summary.expired + summary.pending);
      api.clock.date = new Date(2026, 10, 4, 10, 0, 0);
    });

    it('deletes a member together with the payments', async () => {
      const created = await api.request('POST', '/api/members', newMember({ name: 'Temp' }), token);
      const id = created.body.member.id;
      expect((await api.request('DELETE', `/api/members/${id}`, undefined, token)).status).toBe(204);
      expect((await api.request('GET', `/api/members/${id}`, undefined, token)).status).toBe(404);
      const left = api.container.database.connection
        .prepare('SELECT COUNT(*) AS n FROM member_payments WHERE member_id = ?')
        .get(id) as { n: number };
      expect(left.n).toBe(0);
    });
  });

  describe('rates', () => {
    it('starts with the four official rates', async () => {
      const res = await api.request('GET', '/api/rates', undefined, token);
      expect(res.body).toHaveLength(4);
      expect(res.body[0]).toEqual({ category: 'Regular Plan', type: 'No Treadmill', monthly: 700, semi: 350, daily: 70 });
    });

    it('saves new prices, which the next payment uses, and resets to the official ones', async () => {
      const rates = (await api.request('GET', '/api/rates', undefined, token)).body;
      rates[0].monthly = 750;
      expect((await api.request('PUT', '/api/rates', { rates }, token)).status).toBe(200);
      const m = await api.request('POST', '/api/members', newMember({ name: 'Priced' }), token);
      expect(m.body.payment.amount).toBe(750);

      const reset = await api.request('POST', '/api/rates/reset', {}, token);
      expect(reset.body[0].monthly).toBe(700);
    });

    it('rejects incomplete, duplicate, unknown or negative rows', async () => {
      const rates = (await api.request('GET', '/api/rates', undefined, token)).body;
      expect((await api.request('PUT', '/api/rates', { rates: rates.slice(0, 3) }, token)).status).toBe(400);
      expect((await api.request('PUT', '/api/rates', { rates: [rates[0], rates[0], rates[2], rates[3]] }, token)).status).toBe(400);
      expect((await api.request('PUT', '/api/rates', { rates: rates.map((r: object) => ({ ...r, category: 'VIP' })) }, token)).status).toBe(400);
      expect((await api.request('PUT', '/api/rates', { rates: rates.map((r: object) => ({ ...r, daily: -1 })) }, token)).status).toBe(400);
    });
  });

  describe('settings', () => {
    it('has the default gym name and can be edited', async () => {
      expect((await api.request('GET', '/api/settings', undefined, token)).body.gymName).toBe('NeoFit Fitness Gym');
      const res = await api.request('PUT', '/api/settings', { contact: '0917' }, token);
      expect(res.body).toMatchObject({ gymName: 'NeoFit Fitness Gym', contact: '0917' });
    });
  });

  describe('revenue', () => {
    it('counts member payments on the day they were recorded', async () => {
      const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(res.status).toBe(200);
      expect(res.body.days).toHaveLength(30);
      const day = res.body.days.find((d: { date: string }) => d.date === '2026-11-04');
      // Rose, Ian, Ann, Rose's renewal and "Priced"; "Temp" was deleted with the payment.
      expect(day.paymentCount).toBe(5);
      expect(res.body.paymentsTotal).toBe(res.body.total);
      expect(res.body.yearTotal).toBe(res.body.total);
    });
    it('rejects an invalid month', async () => {
      expect((await api.request('GET', '/api/revenue?year=2026&month=13', undefined, token)).status).toBe(400);
    });
  });

  describe('cloud outbox', () => {
    const outbox = () =>
      api.container.database.connection.prepare('SELECT entity, record_id, action FROM sync_outbox ORDER BY id').all();

    it('queues rate changes, and nothing for members who were never invited', async () => {
      api.container.database.connection.prepare('DELETE FROM sync_outbox').run();
      await api.request('POST', '/api/members', newMember({ name: 'Not Invited' }), token);
      expect(outbox()).toEqual([]);
      await api.request('POST', '/api/rates/reset', {}, token);
      expect(outbox()).toEqual([{ entity: 'rates', record_id: 'rates', action: 'upsert' }]);
    });

    it('queues member and payment changes once the member is invited', async () => {
      const created = await api.request('POST', '/api/members', newMember({ name: 'Invited One' }), token);
      const id = created.body.member.id;
      api.container.database.connection.prepare('UPDATE members SET cloud_id = ? WHERE id = ?').run('cloud-1', id);
      api.container.database.connection.prepare('DELETE FROM sync_outbox').run();

      await api.request('POST', `/api/members/${id}/renew`, {}, token);
      expect((outbox() as { entity: string }[]).map((r) => r.entity)).toEqual(['member', 'payment']);

      api.container.database.connection.prepare('DELETE FROM sync_outbox').run();
      await api.request('DELETE', `/api/members/${id}`, undefined, token);
      expect(outbox()).toEqual([{ entity: 'member', record_id: 'cloud-1', action: 'delete' }]);
    });
  });
});

describe('revenue with logbook pages', () => {
  it('counts the logbook total and skips a payment already written in the logbook', async () => {
    const entries = [new LogbookEntry('Rose', 700), new LogbookEntry('Walk-in', 70)];
    const api = await TestServer.start({
      logbook: {
        logbookRecords: async () => [
          { date: '2026-11-04', totalAmount: Money.pesos(770), entryCount: 2, entries },
        ],
      },
    });
    try {
      const token = await api.login();
      await api.request('POST', '/api/members', { name: 'Rose Garcia', contact: '09171234567', plan: 'Regular Plan - Monthly (No Treadmill)' }, token);
      await api.request('POST', '/api/members', { name: 'Ian', contact: '09181234567', plan: 'Regular Plan - Monthly (No Treadmill)' }, token);
      const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(res.body.logbookTotal).toBe(770);
      expect(res.body.paymentsTotal).toBe(700); // Rose is in the logbook; only Ian is added
      expect(res.body.total).toBe(1470);
      expect(res.body.byCategory.map((c: { category: string }) => c.category).sort()).toEqual(['Logbook', 'Regular Plan']);
    } finally {
      await api.stop();
    }
  });
});

describe('first-run setup', () => {
  it('creates the administrator once, then refuses', async () => {
    const api = await TestServer.start({}, false);
    try {
      expect((await api.request('GET', '/api/setup/status')).body).toEqual({ needsSetup: true });
      expect((await api.request('POST', '/api/setup', { email: 'nope', password: 'long-enough-1' })).status).toBe(400);
      expect((await api.request('POST', '/api/setup', { email: 'a@neofit.test', password: 'short' })).status).toBe(400);

      const created = await api.request('POST', '/api/setup', { email: 'a@neofit.test', password: 'long-enough-1' });
      expect(created.status).toBe(201);
      expect(created.body.token).toBeTruthy();
      expect((await api.request('GET', '/api/members', undefined, created.body.token)).status).toBe(200);

      expect((await api.request('GET', '/api/setup/status')).body).toEqual({ needsSetup: false });
      const again = await api.request('POST', '/api/setup', { email: 'b@neofit.test', password: 'long-enough-1' });
      expect(again.status).toBe(409);
    } finally {
      await api.stop();
    }
  });
});
