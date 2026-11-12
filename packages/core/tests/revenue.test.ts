import { describe, expect, it } from 'vitest';
import {
  type DateRange,
  type IRevenueDataSource,
  LOGBOOK_CATEGORY,
  LogbookEntry,
  type LogbookRecord,
  MemberPayment,
  Money,
  NameMatcher,
  PlanParser,
  RevenueEngine,
} from '../src';

describe('NameMatcher', () => {
  const m = new NameMatcher();
  it('ignores case and extra spaces', () => {
    expect(m.matches('  ROSE   garcia ', 'rose garcia')).toBe(true);
  });
  it('matches when one name contains the other', () => {
    expect(m.matches('Rose', 'Rose Garcia')).toBe(true);
  });
  it('tolerates small handwriting differences', () => {
    expect(m.matches('Nathalie', 'Natalie')).toBe(true);
    expect(m.matches('Jiany', 'Jiani')).toBe(true);
  });
  it('rejects different people and empty names', () => {
    expect(m.matches('Ian', 'Rose')).toBe(false);
    expect(m.matches('', 'Rose')).toBe(false);
  });
  it('computes the Levenshtein distance', () => {
    expect(NameMatcher.levenshtein('kitten', 'sitting')).toBe(3);
  });
});

class FakeSource implements IRevenueDataSource {
  constructor(
    private readonly records: LogbookRecord[] = [],
    private readonly payments: MemberPayment[] = [],
  ) {}
  async logbookRecords(range: DateRange) {
    return this.records.filter((r) => r.date >= range.start && r.date <= range.end);
  }
  async memberPayments(range: DateRange) {
    return this.payments.filter((p) => p.date >= range.start && p.date <= range.end);
  }
}

const page = (date: string, rows: Array<[string, number]>): LogbookRecord => {
  const entries = rows.map(([n, a]) => new LogbookEntry(n, a));
  return { date, entries, entryCount: entries.length, totalAmount: LogbookEntry.total(entries) };
};

const payment = (id: string, name: string, pesos: number, date: string, plan = 'Regular Plan - Monthly') =>
  new MemberPayment(id, name, Money.pesos(pesos), date, PlanParser.parse(plan));

describe('RevenueEngine', () => {
  it('always counts the logbook total', async () => {
    const engine = new RevenueEngine(new FakeSource([page('2026-10-05', [['Ian', 450], ['Rose', 90]])]));
    const month = await engine.month(2026, 10);
    expect(month.total.pesos).toBe(540);
    expect(month.byCategory.get(LOGBOOK_CATEGORY)?.pesos).toBe(540);
    expect(month.days).toHaveLength(31);
  });

  it('skips a member payment already written in the logbook that day', async () => {
    const source = new FakeSource(
      [page('2026-10-05', [['Rose', 700]])],
      [payment('p1', 'Rose Garcia', 700, '2026-10-05')],
    );
    const month = await new RevenueEngine(source).month(2026, 10);
    expect(month.total.pesos).toBe(700);
    expect(month.paymentsTotal.pesos).toBe(0);
  });

  it('counts a payment when the logbook entry is on another day or another person', async () => {
    const source = new FakeSource(
      [page('2026-10-05', [['Ian', 70]])],
      [payment('p1', 'Rose Garcia', 700, '2026-10-05'), payment('p2', 'Ian', 700, '2026-10-06')],
    );
    const month = await new RevenueEngine(source).month(2026, 10);
    expect(month.paymentsTotal.pesos).toBe(1400);
    expect(month.total.pesos).toBe(1470);
    expect(month.byCategory.get('Regular Plan')?.pesos).toBe(1400);
  });

  it('ignores data outside the month', async () => {
    const source = new FakeSource([page('2026-09-30', [['Ian', 70]])], [payment('p', 'Ian', 700, '2026-11-01')]);
    expect((await new RevenueEngine(source).month(2026, 10)).total.pesos).toBe(0);
  });

  it('adds twelve months for the year', async () => {
    const source = new FakeSource([page('2026-01-10', [['A', 100]]), page('2026-12-31', [['B', 200]])]);
    expect((await new RevenueEngine(source).year(2026)).pesos).toBe(300);
  });

  it('compares with the previous month, wrapping over the year', async () => {
    const source = new FakeSource([page('2026-12-10', [['A', 100]]), page('2027-01-10', [['B', 150]])]);
    const cmp = await new RevenueEngine(source).compareWithPrevious(2027, 1);
    expect(cmp.previous.month).toBe(12);
    expect(cmp.changePesos).toBe(50);
    expect(cmp.changePercent).toBe(50);
  });

  it('gives no percentage when the previous month had no revenue', async () => {
    const cmp = await new RevenueEngine(new FakeSource([page('2026-10-10', [['A', 100]])])).compareWithPrevious(2026, 10);
    expect(cmp.changePercent).toBeNull();
  });
});
