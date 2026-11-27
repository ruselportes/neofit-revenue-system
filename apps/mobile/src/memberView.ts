import { daysBetween } from '@neofit/core';
import { dateOfIso } from './format';

/** "Regular Plan - Monthly (No Treadmill)" as a title and a muted second line: "Regular Plan" and "Monthly · No treadmill". */
export function splitPlan(plan: string): { title: string; detail: string } {
  const m = /^(.*?)\s*-\s*(Monthly|Semi-Monthly|Daily)\s*\((No Treadmill|With Treadmill)\)\s*$/i.exec(plan.trim());
  if (!m) return { title: plan.trim(), detail: '' };
  const treadmill = m[3]!.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const period = m[2]!.replace(/^./, (c) => c.toUpperCase());
  return { title: m[1]!, detail: `${period} · ${treadmill}` };
}

export interface RateLike {
  category: string;
  type: string;
  monthly: number;
  semi: number;
  daily: number;
}

export type RatePeriod = 'monthly' | 'semi' | 'daily';

/** Which official rate a member's plan is, and how often it is paid. */
export function planRate(plan: string): { category: string; type: string; period: RatePeriod } {
  return {
    category: /student|senior/i.test(plan) ? 'Student/Senior Plan' : 'Regular Plan',
    type: /with treadmill/i.test(plan) ? 'With Treadmill' : 'No Treadmill',
    period: /daily/i.test(plan) ? 'daily' : /semi/i.test(plan) ? 'semi' : 'monthly',
  };
}

/**
 * Whether a rate card is the member's own plan, for the "Your plan" tag: the same category and treadmill choice, and only
 * while the prices shown are for the period the member pays (a monthly member sees the tag under Monthly only).
 */
export function isOwnRate(plan: string, rate: { category: string; type: string }, shown: RatePeriod): boolean {
  const mine = planRate(plan);
  return mine.period === shown && mine.category === rate.category && mine.type === rate.type;
}

/** The price of the member's own plan from the official rates, for "Renew at the front desk: ₱700.00". Null when it cannot be matched. */
export function renewalPrice(plan: string, rates: RateLike[]): number | null {
  const mine = planRate(plan);
  const rate = rates.find((r) => r.category === mine.category && r.type === mine.type);
  return rate ? rate[mine.period] : null;
}

/**
 * How much of the current period is left, from 1 (just started) down to 0 (ended), for the bar on Home. It measures the
 * period of the latest payment, not the time since the member first joined: someone who has renewed every month for a
 * year would otherwise always show an empty bar.
 */
export function periodRemaining(
  account: { joinedDate: string | null; expiryDate: string | null },
  lastPayment: { periodStart: string | null } | null,
  today: string,
): number {
  const end = account.expiryDate;
  const start = lastPayment?.periodStart ?? account.joinedDate;
  if (!end || !start) return 0;
  const total = daysBetween(start, end) + 1;
  if (total <= 0) return 0;
  if (today < start) return 1; // has not started yet
  return Math.min(1, Math.max(0, daysBetween(today, end) / total));
}

interface PaymentLike {
  id: string;
  paidAt: string;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
}

/** The payment whose period covers today (newest first wins), so its row can say "Current". */
export function currentPaymentId(payments: PaymentLike[], today: string): string | null {
  return payments.find((p) => p.periodStart && p.periodEnd && p.periodStart <= today && today <= p.periodEnd)?.id ?? null;
}

export interface YearGroup<T> {
  year: string;
  total: number;
  items: T[];
}

/** Payments grouped by the year they were paid, keeping the order they came in, with each year's total. */
export function groupByYear<T extends PaymentLike>(payments: T[]): Array<YearGroup<T>> {
  const groups: Array<YearGroup<T>> = [];
  for (const p of payments) {
    const year = dateOfIso(p.paidAt).slice(0, 4);
    let g = groups.find((x) => x.year === year);
    if (!g) groups.push((g = { year, total: 0, items: [] }));
    g.items.push(p);
    g.total += p.amount;
  }
  return groups;
}
