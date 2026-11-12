export type PlanCategory = 'Regular Plan' | 'Student/Senior Plan';
export type TreadmillOption = 'No Treadmill' | 'With Treadmill';
export type BillingPeriod = 'Monthly' | 'Semi-Monthly' | 'Daily';

/** A membership plan, e.g. "Regular Plan - Monthly (No Treadmill)". */
export class Plan {
  constructor(
    readonly category: PlanCategory,
    readonly period: BillingPeriod,
    readonly treadmill: TreadmillOption,
  ) {}

  toString(): string {
    return `${this.category} - ${this.period} (${this.treadmill})`;
  }
}

/** Splits plan text into a Plan. Unknown text falls back to Regular, Monthly, No Treadmill. */
export class PlanParser {
  static parse(text: string): Plan {
    const t = text ?? '';
    const category: PlanCategory = /student|senior/i.test(t) ? 'Student/Senior Plan' : 'Regular Plan';
    const period: BillingPeriod = /daily/i.test(t) ? 'Daily' : /semi/i.test(t) ? 'Semi-Monthly' : 'Monthly';
    const treadmill: TreadmillOption = /with treadmill/i.test(t) ? 'With Treadmill' : 'No Treadmill';
    return new Plan(category, period, treadmill);
  }
}
