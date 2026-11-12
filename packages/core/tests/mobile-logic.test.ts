import { describe, expect, it } from 'vitest';
import {
  LogbookEntry,
  MembershipSummary,
  OwnerStats,
  RateBook,
  RateValidator,
  ReviewSession,
  ValidationError,
  csvCell,
  daysBetween,
  escapeHtml,
  longDate,
  pesoText,
  receiptHtml,
  statusFor,
  toCsv,
} from '../src';

const validator = new RateValidator(RateBook.neofitDefault());
const start = (rows: Array<[string, number | null]>) =>
  ReviewSession.start('2026-11-04', 'Gemini', rows.map(([n, a]) => new LogbookEntry(n, a, `${n} - ${a}`)), validator);

describe('ReviewSession', () => {
  it('flags unofficial amounts, missing amounts and duplicates', () => {
    const rows = start([['Ian', 450], ['Rose', 90], ['Rose', 90], ['Odd', 75], ['Janice', null]]).rows();
    expect(rows.map((r) => r.issues)).toEqual([[], ['duplicate'], ['duplicate'], ['unofficial-amount'], ['missing-amount']]);
  });

  it('updates the flags as the user edits', () => {
    let session = start([['Rose', 90], ['Rose', 90]]);
    session = session.update(2, { amount: 70 });
    expect(session.rows().map((r) => r.issues)).toEqual([[], []]);
    session = session.update(2, { amount: 75 });
    expect(session.rows()[1]!.issues).toEqual(['unofficial-amount']);
  });

  it('is immutable', () => {
    const a = start([['Ian', 450]]);
    const b = a.update(1, { name: 'Ian Cruz' });
    expect(a.rows()[0]!.name).toBe('Ian');
    expect(b.rows()[0]!.name).toBe('Ian Cruz');
  });

  it('adds and removes rows with stable keys', () => {
    const session = start([['A', 70], ['B', 80]]).remove(1).add().add();
    expect(session.rows().map((r) => r.key)).toEqual([2, 3, 4]);
  });

  it('totals only the rows that will be saved, and updates with edits', () => {
    const session = start([['Ian', 450], ['x', 90], ['Rose', null]]).update(2, { name: '' });
    expect(session.total().pesos).toBe(450);
    expect(session.count()).toBe(2);
    expect(session.update(3, { amount: 70 }).total().pesos).toBe(520);
  });

  it('leaves out rows without a name when confirming', () => {
    const upload = start([['Ian', 450], ['x', 90]]).update(2, { name: '  ' }).confirm('u1', 'staff-1');
    expect(upload).toMatchObject({ id: 'u1', date: '2026-11-04', staffId: 'staff-1', totalEntries: 1 });
    expect(upload.totalAmount.pesos).toBe(450);
  });

  it('needs at least one named row', () => {
    expect(() => start([['x', 90]]).update(1, { name: '' }).confirm('u1', 's')).toThrow(ValidationError);
    expect(() => start([]).confirm('u1', 's')).toThrow(/at least one/);
  });

  it('marks duplicates on the saved entries', () => {
    const upload = start([['Rose', 90], ['rose', 90]]).confirm('u1', 's');
    expect(upload.entries.map((e) => e.isDuplicate)).toEqual([true, true]);
  });

  it('rejects a negative amount but allows clearing it', () => {
    const session = start([['Ian', 450]]);
    expect(() => session.update(1, { amount: -5 })).toThrow(ValidationError);
    expect(session.update(1, { amount: null }).rows()[0]!.amount).toBeNull();
  });
});

describe('OwnerStats', () => {
  // Wednesday, Nov 4 2026. This week started Monday Nov 2.
  const uploads = [
    { date: '2026-11-04', total: 500, entries: 5 },
    { date: '2026-11-04', total: 100, entries: 2 },
    { date: '2026-11-02', total: 70, entries: 1 },
    { date: '2026-11-01', total: 300, entries: 4 }, // Sunday: last week
    { date: '2026-10-31', total: 1000, entries: 9 },
    { date: '2026-01-15', total: 2000, entries: 20 },
    { date: '2025-12-31', total: 9999, entries: 99 },
    { date: '2026-11-05', total: 42, entries: 1 }, // in the future: not counted
  ];
  const s = OwnerStats.compute(uploads, '2026-11-04');

  it('adds today, this week from Monday, this month and this year', () => {
    expect(s.today).toBe(600);
    expect(s.todayEntries).toBe(7);
    expect(s.week).toBe(670);
    expect(s.month).toBe(970);
    expect(s.year).toBe(3970);
  });

  it('gives the last seven days, oldest first, with zeros', () => {
    expect(s.last7.map((d) => d.date)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(s.last7.map((d) => d.total)).toEqual([0, 0, 1000, 300, 70, 0, 600]);
  });

  it('starts the week on Monday when today is Sunday or Monday', () => {
    expect(OwnerStats.compute([{ date: '2026-11-02', total: 1, entries: 1 }], '2026-11-08').week).toBe(1); // Sunday
    expect(OwnerStats.compute([{ date: '2026-11-02', total: 1, entries: 1 }], '2026-11-02').week).toBe(1); // Monday
    expect(OwnerStats.compute([{ date: '2026-11-01', total: 1, entries: 1 }], '2026-11-02').week).toBe(0);
  });

  it('works across a year boundary', () => {
    const r = OwnerStats.compute([{ date: '2026-12-30', total: 5, entries: 1 }, { date: '2027-01-02', total: 7, entries: 1 }], '2027-01-02');
    expect(r.last7.map((d) => d.date)[0]).toBe('2026-12-27');
    expect(r.last7.map((d) => d.total)).toEqual([0, 0, 0, 5, 0, 0, 7]);
    expect(r.year).toBe(7); // the Dec 30 upload belongs to last year
    expect(r.week).toBe(12); // Saturday Jan 2 2027: the week began Monday Dec 28, so both uploads count
  });
});

describe('MembershipSummary', () => {
  it('counts the days left and the progress of the period', () => {
    const m = new MembershipSummary('2026-11-01', '2026-11-30', '2026-11-15');
    expect(m.daysLeft).toBe(15);
    expect(m.status).toBe('Active');
    expect(m.progress).toBeCloseTo(0.5, 5);
    expect(m.needsRenewalNotice).toBe(false);
  });
  it('asks to renew within seven days, and after the plan ended', () => {
    expect(new MembershipSummary('2026-11-01', '2026-11-30', '2026-11-25').needsRenewalNotice).toBe(true);
    const ended = new MembershipSummary('2026-10-01', '2026-10-31', '2026-11-04');
    expect([ended.status, ended.daysLeft, ended.progress, ended.needsRenewalNotice]).toEqual(['Expired', 0, 1, true]);
  });
  it('is pending before the start date', () => {
    const m = new MembershipSummary('2026-11-10', '2026-12-09', '2026-11-04');
    expect([m.status, m.progress]).toEqual(['Pending', 0]);
  });
  it('shares the status rule with the desktop (Table 23.0)', () => {
    expect(statusFor('2026-10-01', '2026-11-11', '2026-11-04')).toBe('Expiring Soon');
    expect(statusFor('2026-10-01', '2026-11-12', '2026-11-04')).toBe('Active');
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });
});

describe('receipt', () => {
  const data = {
    receiptNo: '2026-1104-01',
    amount: 1234.5,
    memberName: 'Rose <b>Garcia</b>',
    memberId: 'M-001',
    plan: 'Regular Plan - Monthly (No Treadmill)',
    paidOn: '2026-11-04',
    periodStart: '2026-11-04',
    periodEnd: '2026-12-03',
  };
  it('formats dates and pesos', () => {
    expect(longDate('2026-11-04')).toBe('November 4, 2026');
    expect(longDate(null)).toBe('—');
    expect(pesoText(1234.5)).toBe('₱1,234.50');
    expect(pesoText(700)).toBe('₱700.00');
  });
  it('contains the details and the disclaimer', () => {
    const html = receiptHtml(data);
    for (const text of ['2026-1104-01', '₱1,234.50', 'November 4, 2026 to December 3, 2026', 'NeoFit front desk', 'not an official receipt of the Bureau of Internal Revenue']) {
      expect(html).toContain(text);
    }
  });
  it('escapes text that comes from the database', () => {
    const html = receiptHtml(data);
    expect(html).not.toContain('<b>Garcia</b>');
    expect(html).toContain('Rose &lt;b&gt;Garcia&lt;/b&gt;');
    expect(escapeHtml(`<script>"x"&'</script>`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;&lt;/script&gt;');
  });
});

describe('csv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(450)).toBe('450');
  });
  it('defuses spreadsheet formulas typed as names', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe('-5'); // a real negative number stays a number
  });
  it('writes a header and rows', () => {
    expect(toCsv(['Date', 'Total'], [['2026-11-04', 600]])).toBe('Date,Total\r\n2026-11-04,600\r\n');
  });
});
