import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type IConnectivity,
  type IKeyValueStore,
  type IUploadGateway,
  LogbookSaver,
  type LogbookUpload,
  MembershipSummary,
  OcrParser,
  OfflineQueue,
  OwnerStats,
  RateBook,
  RateValidator,
  ReviewSession,
  receiptHtml,
} from '@neofit/core';
import type { CloudEntry } from '../src/cloud/ports';
import { FakeCloud } from './fakeCloud';
import { TestServer } from './helpers';

/**
 * One story through the whole system, using the real core classes the phone uses and the real desktop API:
 * a staff phone scans a page (offline at first), the desktop counts it once with the front-desk payments,
 * a member is invited, and the member's screens are worked out from what reached the cloud.
 * Dates: the desktop clock is fixed at 2026-11-04.
 */

class MemoryStore implements IKeyValueStore {
  private data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** What the phone's UploadRepository does against Supabase, written against the in-memory cloud. */
class PhoneGateway implements IUploadGateway {
  sends = 0;
  constructor(private readonly cloud: FakeCloud) {}
  async upsertUpload(upload: LogbookUpload): Promise<void> {
    this.sends++;
    this.cloud.uploadsById.set(upload.id, {
      id: upload.id,
      date: upload.date,
      staffId: upload.staffId,
      totalEntries: upload.totalEntries,
      totalAmount: upload.totalAmount.pesos,
    });
    // fixed ids per row, as the real repository does, so sending twice replaces rather than duplicates
    upload.entries.forEach((e, i) => {
      const id = `${upload.id}:${i}`;
      const row: CloudEntry = { id, uploadId: upload.id, name: e.name, amount: e.amount?.pesos ?? null, originalText: e.originalText, createdAt: `2026-11-04T01:00:0${i}.000Z` };
      this.cloud.entriesById.set(id, row);
    });
  }
}

describe('a day at NeoFit, end to end', () => {
  const cloud = new FakeCloud();
  const gateway = new PhoneGateway(cloud);
  let api: TestServer;
  let token: string;
  let online = false;
  const connectivity: IConnectivity = { isOnline: async () => online };
  const queue = new OfflineQueue(new MemoryStore(), gateway);
  const saver = new LogbookSaver(gateway, queue, connectivity);
  const rates = RateBook.neofitDefault();
  const validator = new RateValidator(rates);
  let page: LogbookUpload;

  beforeAll(async () => {
    api = await TestServer.start({ cloud });
    token = await api.login();
  });
  afterAll(() => api.stop());

  it('1. the staff phone reads a page, flags what looks wrong, and the user fixes it', () => {
    // What the phone's reader returns for the photographed page.
    const entries = new OcrParser().parse('1. Ian - 450 - G-Cash\n2. Rose - 90\n3. Rose - 90\n4. Janice\n5. Odd - 75');
    let session = ReviewSession.start('2026-11-04', 'Gemini', entries, validator);

    const flags = session.rows().map((r) => [r.name, r.issues]);
    expect(flags).toEqual([
      ['Ian', []], // 450 is the official semi-monthly price with the treadmill
      ['Rose', ['duplicate']],
      ['Rose', ['duplicate']],
      ['Janice', ['missing-amount']],
      ['Odd', ['unofficial-amount']],
    ]);

    session = session.remove(3).update(4, { amount: 70 }).update(5, { amount: 80 }); // delete the repeat, fill Janice, fix Odd
    expect(session.rows().every((r) => r.issues.length === 0)).toBe(true); // nothing left to check

    page = session.confirm('11111111-1111-4111-8111-111111111111', 'staff-1');
    expect(page.totalEntries).toBe(4);
    expect(page.totalAmount.pesos).toBe(450 + 90 + 70 + 80);
  });

  it('2. with no signal the page waits on the phone and is not lost', async () => {
    online = false;
    expect(await saver.save(page)).toBe('queued');
    expect(await queue.pendingCount()).toBe(1);
    expect(cloud.uploadsById.size).toBe(0);
  });

  it('3. the desktop does not see the page yet', async () => {
    const res = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
    expect(res.body.logbookTotal).toBe(0);
  });

  it('4. when the phone is online again the queue uploads it, and sending twice makes no duplicates', async () => {
    online = true;
    expect(await queue.syncQueue()).toEqual({ synced: 1, failed: 0 });
    expect(await queue.pendingCount()).toBe(0);

    await gateway.upsertUpload(page); // a retry of the same page
    expect(cloud.uploadsById.size).toBe(1);
    expect(cloud.entriesById.size).toBe(4);
  });

  it('5. the desktop shows the page in the logbook, marked as scanned', async () => {
    const day = await api.request('GET', '/api/logbook?date=2026-11-04', undefined, token);
    expect(day.body).toMatchObject({ count: 4, total: 690 });
    expect(day.body.entries.map((e: { name: string; source: string }) => [e.name, e.source])).toEqual([
      ['Ian', 'scan'], ['Rose', 'scan'], ['Janice', 'scan'], ['Odd', 'scan'],
    ]);
  });

  it('6. a payment already written in the logbook is counted once; one that is not is added', async () => {
    const add = (name: string) =>
      api.request('POST', '/api/members', { name, contact: '0917', plan: 'Regular Plan - Monthly (No Treadmill)', email: `${name.split(' ')[0]!.toLowerCase()}@example.com` }, token);
    // Revenue keeps the logbook it read for 60 seconds (step 3 read it before the page arrived), so a minute passes.
    api.clock.date = new Date(2026, 10, 4, 10, 2, 0);

    await add('Rose Garcia'); // "Rose" is in the logbook today: not added again
    await add('Ian Cruz'); //  "Ian" is in the logbook today: not added again
    await add('Maria Santos'); // not in the logbook: counted

    const rev = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
    expect(rev.body).toMatchObject({ logbookTotal: 690, paymentsTotal: 700, total: 1390, logbookStale: false });
    expect(rev.body.byCategory).toEqual([ // largest first
      { category: 'Regular Plan', revenue: 700 },
      { category: 'Logbook', revenue: 690 },
    ]);
  });

  it('7. the owner\'s phone shows the same logbook figures', async () => {
    const uploads = [...cloud.uploadsById.values()].map((u) => ({ date: u.date, total: u.totalAmount, entries: u.totalEntries }));
    const stats = OwnerStats.compute(uploads, '2026-11-04');
    expect(stats).toMatchObject({ today: 690, todayEntries: 4, week: 690, month: 690, year: 690 });
  });

  it('8. the desktop corrects a wrong amount, and revenue follows', async () => {
    const odd = [...cloud.entriesById.values()].find((e) => e.name === 'Odd')!;
    await api.request('PUT', `/api/logbook/entries/${odd.id}`, { name: 'Odd', amount: 70 }, token);
    const rev = await api.request('GET', '/api/revenue?year=2026&month=11', undefined, token);
    expect(rev.body.logbookTotal).toBe(680);
    expect(rev.body.total).toBe(1380);
    expect(cloud.uploadsById.get(page.id)).toMatchObject({ totalEntries: 4, totalAmount: 680 });
  });

  it('9. an invited member\'s account and payments reach the cloud, and their screens follow', async () => {
    const maria = (await api.request('GET', '/api/members', undefined, token)).body.find((m: { name: string }) => m.name === 'Maria Santos');
    const invited = await api.request('POST', `/api/members/${maria.id}/invite`, {}, token);
    expect(invited.body.status).toBe('invited');

    const account = cloud.accounts.get(invited.body.member.cloudId)!;
    expect(account).toMatchObject({ memberId: 'M-003', email: 'maria@example.com', expiryDate: '2026-12-03' });
    const [payment] = [...cloud.payments.values()];
    expect(payment).toMatchObject({ accountId: account.id, amount: 700, receiptNo: '2026-1104-03' });

    // What Maria's phone works out from those cloud rows:
    const summary = new MembershipSummary(account.joinedDate, account.expiryDate, '2026-11-04');
    expect([summary.status, summary.daysLeft, summary.needsRenewalNotice]).toEqual(['Active', 29, false]);
    expect(receiptHtml({
      receiptNo: payment!.receiptNo, amount: payment!.amount, memberName: account.name, memberId: account.memberId,
      plan: payment!.plan, paidOn: '2026-11-04', periodStart: payment!.periodStart, periodEnd: payment!.periodEnd,
    })).toContain('2026-1104-03');
  });

  it('10. a month later the same member is told to renew, and renewing publishes the new period', async () => {
    const account = [...cloud.accounts.values()][0]!;
    const late = new MembershipSummary(account.joinedDate, account.expiryDate, '2026-11-30');
    expect([late.status, late.daysLeft, late.needsRenewalNotice]).toEqual(['Expiring Soon', 3, true]);

    const maria = (await api.request('GET', '/api/members', undefined, token)).body.find((m: { name: string }) => m.name === 'Maria Santos');
    await api.request('POST', `/api/members/${maria.id}/renew`, {}, token);
    for (let i = 0; i < 100 && cloud.payments.size < 2; i++) await new Promise((r) => setTimeout(r, 10));
    expect(cloud.payments.size).toBe(2);
    expect([...cloud.accounts.values()][0]!.expiryDate).toBe('2027-01-03');
  });
});
