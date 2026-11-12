import type { Rate } from './api/types';

export const CATEGORIES = ['Regular Plan', 'Student/Senior Plan'] as const;
export const PERIODS = ['Monthly', 'Semi-Monthly', 'Daily'] as const;
export const TREADMILL = ['No Treadmill', 'With Treadmill'] as const;

export interface PlanChoice {
  category: (typeof CATEGORIES)[number];
  period: (typeof PERIODS)[number];
  treadmill: (typeof TREADMILL)[number];
}

export const DEFAULT_PLAN: PlanChoice = { category: 'Regular Plan', period: 'Monthly', treadmill: 'No Treadmill' };

/** "Regular Plan - Monthly (No Treadmill)" */
export function planText(p: PlanChoice): string {
  return `${p.category} - ${p.period} (${p.treadmill})`;
}

/** Reads plan text the same way the server does; unknown text gives the default plan. */
export function parsePlan(text: string): PlanChoice {
  return {
    category: /student|senior/i.test(text) ? 'Student/Senior Plan' : 'Regular Plan',
    period: /daily/i.test(text) ? 'Daily' : /semi/i.test(text) ? 'Semi-Monthly' : 'Monthly',
    treadmill: /with treadmill/i.test(text) ? 'With Treadmill' : 'No Treadmill',
  };
}

export function priceOf(p: PlanChoice, rates: Rate[]): number | undefined {
  const rate = rates.find((r) => r.category === p.category && r.type === p.treadmill);
  if (!rate) return undefined;
  return p.period === 'Monthly' ? rate.monthly : p.period === 'Semi-Monthly' ? rate.semi : rate.daily;
}
