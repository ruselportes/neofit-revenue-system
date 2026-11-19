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

/** The price of the member's own plan from the official rates, for "Renew at the front desk: ₱700.00". Null when it cannot be matched. */
export function renewalPrice(plan: string, rates: RateLike[]): number | null {
  const category = /student|senior/i.test(plan) ? 'Student/Senior Plan' : 'Regular Plan';
  const type = /with treadmill/i.test(plan) ? 'With Treadmill' : 'No Treadmill';
  const rate = rates.find((r) => r.category === category && r.type === type);
  if (!rate) return null;
  return /daily/i.test(plan) ? rate.daily : /semi/i.test(plan) ? rate.semi : rate.monthly;
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
