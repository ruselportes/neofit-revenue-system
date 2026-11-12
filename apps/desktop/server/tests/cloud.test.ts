import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServerConfig } from '../src/config/ServerConfig';
import { FakeCloud } from './fakeCloud';
import { TestServer } from './helpers';

async function until(check: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('Timed out waiting for the condition.');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const member = (over: object = {}) => ({
  name: 'Rose Garcia',
  contact: '09171234567',
  plan: 'Regular Plan - Monthly (No Treadmill)',
  ...over,
});

describe('cloud settings', () => {
  const base = { jwtSecret: 'x'.repeat(32), dbPath: 'a.db', port: 3001, tokenTtl: '24h', corsOrigins: [] };
  const cloud = { url: 'https://abc.supabase.co', anonKey: 'anon', ownerEmail: 'o@neofit.test', ownerPassword: 'pw-pw-pw-pw' };

  it('is optional', () => {
    expect(ServerConfig.from(base).cloud).toBeUndefined();
  });
  it('needs every value, and an encrypted address', () => {
    expect(() => ServerConfig.from({ ...base, cloud: { ...cloud, ownerPassword: '' } })).toThrow(/together/);
    expect(() => ServerConfig.from({ ...base, cloud: { ...cloud, url: 'http://abc.supabase.co' } })).toThrow(/https/);
    expect(() => ServerConfig.from({ ...base, cloud: { ...cloud, url: 'http://127.0.0.1:54321' } })).not.toThrow();
  });
  it('is read from the environment', () => {
    const config = ServerConfig.fromEnv({
      JWT_SECRET: 'x'.repeat(32),
      DB_PATH: 'a.db',
      SUPABASE_URL: 'https://abc.supabase.co/',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_OWNER_EMAIL: 'o@neofit.test',
      SUPABASE_OWNER_PASSWORD: 'pw-pw-pw-pw',
    });
    expect(config.cloud?.url).toBe('https://abc.supabase.co');
  });
});

describe('without a cloud connection', () => {
  let api: TestServer;
  let token: string;
  beforeEach(async () => {
    api = await TestServer.start();
    token = await api.login();
  });
  afterEach(() => api.stop());

  it('reports that it is not configured and answers 503 on cloud features', async () => {
    expect((await api.request('GET', '/api/cloud/status', undefined, token)).body).toEqual({ configured: false });
    for (const [method, path, body] of [
      ['GET', '/api/logbook', undefined],
      ['GET', '/api/logbook/totals', undefined],
      ['GET', '/api/announcements', undefined],
      ['POST', '/api/members/1/invite', {}],
    ] as const) {
      expect((await api.request(method, path, body, token)).status).toBe(503);
    }
  });

  it('still computes revenue and says the logbook is not stale', async () => {
    const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
    expect(res.status).toBe(200);
    expect(res.body.logbookStale).toBe(false);
  });
});

describe('with a cloud connection', () => {
  let cloud: FakeCloud;
  let api: TestServer;
  let token: string;

  beforeEach(async () => {
    cloud = new FakeCloud();
    api = await TestServer.start({ cloud });
    token = await api.login();
  });
  afterEach(() => api.stop());

  const outbox = () => api.container.database.connection.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get() as { n: number };

  describe('logbook', () => {
    it('lists the entries of a day with their source and total', async () => {
      cloud.seedPage('2026-11-04', [['Ian', 450], ['Rose', 90]]);
      cloud.seedPage('2026-11-04', [['Walk-in', 70]], false);
      cloud.seedPage('2026-11-05', [['Other', 60]]);

      const res = await api.request('GET', '/api/logbook?date=2026-11-04', undefined, token);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ date: '2026-11-04', count: 3, total: 610 });
      expect(res.body.entries.map((e: { name: string; source: string }) => [e.name, e.source])).toEqual([
        ['Ian', 'scan'],
        ['Rose', 'scan'],
        ['Walk-in', 'manual'],
      ]);
    });

    it('defaults to today and rejects a bad date', async () => {
      cloud.seedPage('2026-11-04', [['Ian', 450]]);
      expect((await api.request('GET', '/api/logbook', undefined, token)).body.count).toBe(1);
      expect((await api.request('GET', '/api/logbook?date=yesterday', undefined, token)).status).toBe(400);
    });

    it('gives the total of every day of the month for the calendar', async () => {
      cloud.seedPage('2026-11-04', [['A', 100], ['B', 50]]);
      cloud.seedPage('2026-11-04', [['C', 20]]);
      cloud.seedPage('2026-11-20', [['D', 70]]);
      cloud.seedPage('2026-10-31', [['E', 999]]);
      const res = await api.request('GET', '/api/logbook/totals?year=2026&month=11', undefined, token);
      expect(res.body).toEqual([
        { date: '2026-11-04', count: 3, total: 170 },
        { date: '2026-11-20', count: 1, total: 70 },
      ]);
    });

    it('adds entries by hand on a new page and backs them up locally', async () => {
      const res = await api.request(
        'POST',
        '/api/logbook/entries',
        { date: '2026-11-04', entries: [{ name: 'Manual One', amount: 90 }, { name: 'No Amount' }] },
        token,
      );
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ count: 2, total: 90 });
      expect(res.body.entries.every((e: { source: string }) => e.source === 'manual')).toBe(true);
      expect([...cloud.uploadsById.values()][0]).toMatchObject({ staffId: 'owner-1', totalEntries: 2, totalAmount: 90 });
      const backup = api.container.database.connection.prepare('SELECT name, amount, date FROM logbook_entries_backup ORDER BY name').all();
      expect(backup).toEqual([
        { name: 'Manual One', amount: 90, date: '2026-11-04' },
        { name: 'No Amount', amount: 0, date: '2026-11-04' },
      ]);
    });

    it('rejects bad entries', async () => {
      const post = (body: unknown) => api.request('POST', '/api/logbook/entries', body, token);
      expect((await post({ date: '2026-11-04', entries: [] })).status).toBe(400);
      expect((await post({ date: '2026-11-04', entries: [{ name: '' }] })).status).toBe(400);
      expect((await post({ date: '2026-11-04', entries: [{ name: 'A', amount: -1 }] })).status).toBe(400);
      expect((await post({ date: 'nope', entries: [{ name: 'A' }] })).status).toBe(400);
      expect(cloud.uploadsById.size).toBe(0);
    });

    it('corrects an entry, recomputes the page and mirrors it', async () => {
      const page = cloud.seedPage('2026-11-04', [['Ian', 450], ['Rose', 90]]);
      const id = [...cloud.entriesById.values()][0]!.id;
      const res = await api.request('PUT', `/api/logbook/entries/${id}`, { name: 'Ian Cruz', amount: 70 }, token);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Ian Cruz', amount: 70 });
      expect(cloud.uploadsById.get(page.id)).toMatchObject({ totalEntries: 2, totalAmount: 160 });
      expect(api.container.database.connection.prepare('SELECT name FROM logbook_entries_backup').all()).toEqual([{ name: 'Ian Cruz' }]);
    });

    it('answers 404 for an unknown entry', async () => {
      expect((await api.request('PUT', '/api/logbook/entries/nope', { name: 'A' }, token)).status).toBe(404);
      expect((await api.request('DELETE', '/api/logbook/entries/nope', undefined, token)).status).toBe(404);
    });

    it('deleting an entry recomputes the page, and the last entry removes the page', async () => {
      const page = cloud.seedPage('2026-11-04', [['Ian', 450], ['Rose', 90]]);
      const [first, second] = [...cloud.entriesById.values()];
      expect((await api.request('DELETE', `/api/logbook/entries/${first!.id}`, undefined, token)).status).toBe(204);
      expect(cloud.uploadsById.get(page.id)).toMatchObject({ totalEntries: 1, totalAmount: 90 });

      await api.request('DELETE', `/api/logbook/entries/${second!.id}`, undefined, token);
      expect(cloud.uploadsById.has(page.id)).toBe(false);
    });

    it('deletes every entry of a date', async () => {
      cloud.seedPage('2026-11-04', [['A', 1], ['B', 2]]);
      cloud.seedPage('2026-11-04', [['C', 3]]);
      cloud.seedPage('2026-11-05', [['D', 4]]);
      const res = await api.request('DELETE', '/api/logbook?date=2026-11-04', undefined, token);
      expect(res.body).toEqual({ deleted: 3 });
      expect([...cloud.entriesById.values()].map((e) => e.name)).toEqual(['D']);
    });
  });

  describe('revenue with the cloud logbook', () => {
    it('counts the logbook once and skips a payment already written in it', async () => {
      cloud.seedPage('2026-11-04', [['Rose', 700], ['Walk-in', 70]]);
      await api.request('POST', '/api/members', member(), token);
      await api.request('POST', '/api/members', member({ name: 'Ian' }), token);
      const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(res.body).toMatchObject({ logbookTotal: 770, paymentsTotal: 700, total: 1470, logbookStale: false });
    });

    it('keeps the logbook for 60 seconds, and clears it after a correction', async () => {
      cloud.seedPage('2026-11-04', [['Ian', 100]]);
      await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      const afterFirst = cloud.calls.uploads;
      await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(cloud.calls.uploads).toBe(afterFirst);

      const id = [...cloud.entriesById.values()][0]!.id;
      await api.request('PUT', `/api/logbook/entries/${id}`, { name: 'Ian', amount: 200 }, token);
      const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(res.body.logbookTotal).toBe(200);
    });

    it('still answers when the cloud is unreachable, and says the logbook may be out of date', async () => {
      cloud.seedPage('2026-11-04', [['Ian', 100]]);
      await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      cloud.offline = true;
      api.clock.date = new Date(2026, 10, 4, 10, 5, 0); // the cache has expired
      const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(res.status).toBe(200);
      expect(res.body.logbookStale).toBe(true);
      expect(res.body.logbookTotal).toBe(100); // the last copy
    });

    it('reports a logbook that was never loaded as missing, not as zero revenue', async () => {
      cloud.offline = true;
      const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
      expect(res.status).toBe(200);
      expect(res.body.logbookStale).toBe(true);
    });
  });

  describe('member invites and publishing', () => {
    it('asks for an email address first', async () => {
      await api.request('POST', '/api/members', member(), token);
      const res = await api.request('POST', '/api/members/1/invite', {}, token);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email/i);
      expect(cloud.accounts.size).toBe(0);
    });

    it('publishes the member and the payments, then invites', async () => {
      await api.request('POST', '/api/members', member({ email: 'rose@example.com' }), token);
      const res = await api.request('POST', '/api/members/1/invite', {}, token);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('invited');
      expect(res.body.member).toMatchObject({ invitedAt: '2026-11-04T10:00:00.000Z' });

      const cloudId = res.body.member.cloudId as string;
      expect(cloudId).toMatch(/^[0-9a-f-]{36}$/);
      expect(cloud.accounts.get(cloudId)).toMatchObject({ memberId: 'M-001', email: 'rose@example.com', expiryDate: '2026-12-03' });
      expect([...cloud.payments.values()]).toEqual([expect.objectContaining({ accountId: cloudId, amount: 700, receiptNo: '2026-1104-01' })]);
      expect(cloud.invites).toEqual([cloudId]);
    });

    it('saves a new email address given with the invite', async () => {
      await api.request('POST', '/api/members', member(), token);
      const res = await api.request('POST', '/api/members/1/invite', { email: 'rose@example.com' }, token);
      expect(res.status).toBe(200);
      expect(res.body.member.email).toBe('rose@example.com');
    });

    it('sends a new link, not a second account, when invited again', async () => {
      await api.request('POST', '/api/members', member({ email: 'rose@example.com' }), token);
      const first = await api.request('POST', '/api/members/1/invite', {}, token);
      const second = await api.request('POST', '/api/members/1/invite', {}, token);
      expect(second.body.status).toBe('resent');
      expect(second.body.member.cloudId).toBe(first.body.member.cloudId);
      expect(cloud.accounts.size).toBe(1);
    });

    it('does not mark the member as invited when the cloud cannot be reached', async () => {
      await api.request('POST', '/api/members', member({ email: 'rose@example.com' }), token);
      cloud.offline = true;
      const res = await api.request('POST', '/api/members/1/invite', {}, token);
      expect(res.status).toBe(503);
      expect((await api.request('GET', '/api/members/1', undefined, token)).body).toMatchObject({ invitedAt: null, cloudId: null });
    });

    it('publishes a renewal of an invited member to the cloud', async () => {
      await api.request('POST', '/api/members', member({ email: 'rose@example.com' }), token);
      const invited = await api.request('POST', '/api/members/1/invite', {}, token);
      await api.request('POST', '/api/members/1/renew', {}, token);

      await until(() => cloud.payments.size === 2);
      await until(() => outbox().n === 0);
      expect(cloud.accounts.get(invited.body.member.cloudId)?.expiryDate).toBe('2027-01-03');
    });

    it('never publishes members who were not invited', async () => {
      await api.request('POST', '/api/members', member(), token);
      await api.request('POST', '/api/members/1/renew', {}, token);
      await new Promise((r) => setTimeout(r, 50));
      expect(cloud.accounts.size).toBe(0);
      expect(cloud.payments.size).toBe(0);
      expect(outbox().n).toBe(0);
    });

    it('removes the cloud copy when an invited member is deleted', async () => {
      await api.request('POST', '/api/members', member({ email: 'rose@example.com' }), token);
      const invited = await api.request('POST', '/api/members/1/invite', {}, token);
      await api.request('DELETE', '/api/members/1', undefined, token);
      await until(() => cloud.removed.length === 1);
      expect(cloud.removed).toEqual([invited.body.member.cloudId]);
    });

    it('keeps changes in the outbox while the cloud is unreachable and sends them later', async () => {
      await api.request('POST', '/api/members', member({ email: 'rose@example.com' }), token);
      const invited = await api.request('POST', '/api/members/1/invite', {}, token);

      cloud.offline = true;
      await api.request('PUT', '/api/members/1', { name: 'Rose G. Garcia' }, token);
      await until(() => api.container.database.connection.prepare('SELECT attempts FROM sync_outbox').all().length === 1);
      await until(() => (api.container.database.connection.prepare('SELECT attempts FROM sync_outbox').get() as { attempts: number }).attempts >= 1);

      cloud.offline = false;
      await api.container.cloud.publishNow();
      await until(() => outbox().n === 0);
      expect(cloud.accounts.get(invited.body.member.cloudId)?.name).toBe('Rose G. Garcia');
    });

    it('publishes the rates after a change', async () => {
      const rates = (await api.request('GET', '/api/rates', undefined, token)).body;
      rates[0].monthly = 750;
      await api.request('PUT', '/api/rates', { rates }, token);
      await until(() => cloud.rates.length === 4);
      expect(cloud.rates[0]).toMatchObject({ category: 'Regular Plan', monthly: 750 });
    });
  });

  describe('announcements', () => {
    it('posts, lists newest first, and removes', async () => {
      const a = await api.request('POST', '/api/announcements', { title: 'Holiday hours', body: 'Closed on Nov 1.' }, token);
      expect(a.status).toBe(201);
      await api.request('POST', '/api/announcements', { title: 'New rates', body: 'See the Rates tab.' }, token);

      const list = (await api.request('GET', '/api/announcements', undefined, token)).body;
      expect(list.map((x: { title: string }) => x.title)).toEqual(['New rates', 'Holiday hours']);

      expect((await api.request('DELETE', `/api/announcements/${a.body.id}`, undefined, token)).status).toBe(204);
      expect((await api.request('GET', '/api/announcements', undefined, token)).body).toHaveLength(1);
    });

    it('rejects empty and too long text, and a bad id', async () => {
      expect((await api.request('POST', '/api/announcements', { title: '', body: 'x' }, token)).status).toBe(400);
      expect((await api.request('POST', '/api/announcements', { title: 'x'.repeat(81), body: 'x' }, token)).status).toBe(400);
      expect((await api.request('POST', '/api/announcements', { title: 'x', body: 'x'.repeat(501) }, token)).status).toBe(400);
      expect((await api.request('DELETE', '/api/announcements/not-an-id', undefined, token)).status).toBe(400);
    });
  });

  it('protects every cloud route with the sign-in', async () => {
    for (const [method, path] of [
      ['GET', '/api/logbook'],
      ['GET', '/api/announcements'],
      ['POST', '/api/members/1/invite'],
      ['DELETE', '/api/logbook?date=2026-11-04'],
    ] as const) {
      expect((await api.request(method, path)).status).toBe(401);
    }
  });
});
