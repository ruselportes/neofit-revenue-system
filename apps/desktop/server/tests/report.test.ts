import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LogbookEntry, Money } from '@neofit/core';
import { WordRevenueReport } from '../src/reports/WordRevenueReport';
import type { RevenueReport } from '../src/services/RevenueService';
import { TestServer } from './helpers';

/** The visible text of a .docx file. */
async function textOf(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
}

const sample: RevenueReport = {
  logbookStale: false,
  year: 2026,
  month: 11,
  total: 1470,
  logbookTotal: 770,
  paymentsTotal: 700,
  yearTotal: 5000,
  days: [
    { date: '2026-11-03', logbook: 0, logbookCount: 0, payments: 0, paymentCount: 0, total: 0 },
    { date: '2026-11-04', logbook: 770, logbookCount: 2, payments: 700, paymentCount: 1, total: 1470 },
  ],
  byCategory: [{ category: 'Logbook', revenue: 770 }, { category: 'Regular Plan', revenue: 700 }],
  previous: { year: 2026, month: 10, total: 1000, changePesos: 470, changePercent: 47 },
};

describe('WordRevenueReport', () => {
  const exporter = new WordRevenueReport();
  const when = new Date('2026-11-04T10:00:00');

  it('is a Word file with the month, the totals and every breakdown', async () => {
    const bytes = await exporter.export(sample, when);
    expect(bytes.subarray(0, 2).toString()).toBe('PK'); // a .docx is a zip file
    const text = await textOf(bytes);
    for (const expected of [
      'Revenue Report: November 2026',
      '₱1,470.00',
      '₱770.00',
      '₱700.00',
      '₱5,000.00',
      '+47.0% (₱470.00 more) than October 2026',
      'Logbook scans',
      'Member payments',
      'Regular Plan',
      'November 4, 2026',
      'Each payment is counted once',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('lists only the days that had revenue, and ends with a total row', async () => {
    const text = await textOf(await exporter.export(sample, when));
    expect(text).not.toContain('November 3, 2026');
    expect(text).toMatch(/Total\s*₱770\.00\s*₱700\.00\s*₱1,470\.00/);
  });

  it('warns when the logbook could not be refreshed', async () => {
    const text = await textOf(await exporter.export({ ...sample, logbookStale: true }, when));
    expect(text).toContain('could not be refreshed from the cloud');
    expect(await textOf(await exporter.export(sample, when))).not.toContain('could not be refreshed');
  });

  it('handles a month with no revenue and no earlier month to compare with', async () => {
    const empty: RevenueReport = {
      ...sample, total: 0, logbookTotal: 0, paymentsTotal: 0, days: [], byCategory: [],
      previous: { year: 2026, month: 10, total: 0, changePesos: 0, changePercent: null },
    };
    const text = await textOf(await exporter.export(empty, when));
    expect(text).toContain('No revenue was recorded this month.');
    expect(text).toContain('No revenue in the previous month to compare with');
  });

  it('writes a drop in revenue as "less"', async () => {
    const text = await textOf(await exporter.export({ ...sample, previous: { ...sample.previous, changePesos: -300, changePercent: -20 } }, when));
    expect(text).toContain('-20.0% (₱300.00 less) than October 2026');
  });

  it('names the file after the month', () => {
    expect(exporter.fileName(WordRevenueReport.label(sample))).toBe('NeoFit-Revenue-2026-11.docx');
  });
});

describe('GET /api/revenue/report', () => {
  let api: TestServer;
  let token: string;
  beforeEach(async () => {
    api = await TestServer.start({
      logbook: {
        logbookRecords: async () => [{ date: '2026-11-04', totalAmount: Money.pesos(70), entryCount: 1, entries: [new LogbookEntry('Walk-in', 70)] }],
      },
    });
    token = await api.login();
  });
  afterEach(() => api.stop());

  it('downloads the report for a month', async () => {
    await api.request('POST', '/api/members', { name: 'Ian', contact: '09171234567', email: 'ian@example.com', plan: 'Regular Plan - Monthly (No Treadmill)' }, token);
    const res = await api.download('/api/revenue/report?year=2026&month=11', token);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('wordprocessingml.document');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="NeoFit-Revenue-2026-11.docx"');
    const text = await textOf(res.bytes);
    expect(text).toContain('Revenue Report: November 2026');
    expect(text).toContain('₱770.00'); // ₱70 from the logbook and ₱700 from the new member
  });

  it('needs the sign-in', async () => {
    expect((await api.download('/api/revenue/report?year=2026&month=11')).status).toBe(401);
  });

  it('rejects a bad month instead of making a file', async () => {
    const res = await api.download('/api/revenue/report?year=2026&month=13', token);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('json');
  });
});
