import { describe, expect, it } from 'vitest';
import { currentPaymentId, groupByYear, periodRemaining, renewalPrice, splitPlan } from '../src/memberView';

const RATES = [
  { category: 'Regular Plan', type: 'No Treadmill', monthly: 700, semi: 350, daily: 70 },
  { category: 'Regular Plan', type: 'With Treadmill', monthly: 900, semi: 450, daily: 90 },
  { category: 'Student/Senior Plan', type: 'No Treadmill', monthly: 600, semi: 300, daily: 60 },
  { category: 'Student/Senior Plan', type: 'With Treadmill', monthly: 800, semi: 400, daily: 80 },
];

describe('the plan on Home', () => {
  it('splits a plan into a title and a muted second line', () => {
    expect(splitPlan('Regular Plan - Monthly (No Treadmill)')).toEqual({ title: 'Regular Plan', detail: 'Monthly · No treadmill' });
    expect(splitPlan('Student/Senior Plan - Semi-Monthly (With Treadmill)')).toEqual({ title: 'Student/Senior Plan', detail: 'Semi-Monthly · With treadmill' });
    expect(splitPlan('Regular Plan - Daily (No Treadmill)').detail).toBe('Daily · No treadmill');
  });
  it('leaves text it does not understand alone', () => {
    expect(splitPlan('Something else')).toEqual({ title: 'Something else', detail: '' });
  });
});

describe('the renewal price', () => {
  it('finds the member\'s own plan in the official rates', () => {
    expect(renewalPrice('Regular Plan - Monthly (No Treadmill)', RATES)).toBe(700);
    expect(renewalPrice('Regular Plan - Monthly (With Treadmill)', RATES)).toBe(900);
    expect(renewalPrice('Student/Senior Plan - Semi-Monthly (No Treadmill)', RATES)).toBe(300);
    expect(renewalPrice('Student Plan - Daily (With Treadmill)', RATES)).toBe(80);
  });
  it('is null when the rates are not there', () => {
    expect(renewalPrice('Regular Plan - Monthly (No Treadmill)', [])).toBeNull();
  });
});

describe('the bar on Home shows time left in the current period', () => {
  const acct = { joinedDate: '2025-01-10', expiryDate: '2026-11-25' };
  const last = { periodStart: '2026-10-26' }; // a 31-day period, Oct 26 to Nov 25
  it('is nearly empty at 5 days left, not full', () => {
    expect(periodRemaining(acct, last, '2026-11-20')).toBeCloseTo(5 / 31, 5);
  });
  it('is full on the first day and empty once it has ended', () => {
    expect(periodRemaining(acct, last, '2026-10-26')).toBeCloseTo(30 / 31, 5);
    expect(periodRemaining(acct, last, '2026-11-25')).toBe(0);
    expect(periodRemaining(acct, last, '2026-12-05')).toBe(0);
  });
  it('is not fooled by a member who joined long ago and renews every month', () => {
    expect(periodRemaining(acct, last, '2026-11-01')).toBeGreaterThan(0.7); // not ~0 as "since joining" would give
  });
  it('is full for a plan that has not started, and 0 with no dates', () => {
    expect(periodRemaining({ joinedDate: '2026-12-01', expiryDate: '2026-12-31' }, null, '2026-11-20')).toBe(1);
    expect(periodRemaining({ joinedDate: null, expiryDate: null }, null, '2026-11-20')).toBe(0);
  });
});

describe('the payments list', () => {
  const pay = (id: string, paidAt: string, amount: number, start: string, end: string) => ({ id, paidAt, amount, periodStart: start, periodEnd: end });
  const list = [
    pay('c', '2026-10-26T09:00:00', 700, '2026-10-26', '2026-11-25'),
    pay('b', '2026-09-25T09:00:00', 700, '2026-09-25', '2026-10-25'),
    pay('a', '2025-12-20T09:00:00', 650, '2025-12-20', '2026-01-19'),
  ];
  it('marks the payment that covers today as current', () => {
    expect(currentPaymentId(list, '2026-11-20')).toBe('c');
    expect(currentPaymentId(list, '2026-10-01')).toBe('b');
    expect(currentPaymentId(list, '2027-03-01')).toBeNull();
    expect(currentPaymentId([], '2026-11-20')).toBeNull();
  });
  it('groups by year with each year\'s total, in order', () => {
    const g = groupByYear(list);
    expect(g.map((x) => [x.year, x.total, x.items.length])).toEqual([['2026', 1400, 2], ['2025', 650, 1]]);
  });
});
