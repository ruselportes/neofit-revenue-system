import { ValidationError } from '../errors';
import { Money } from './Money';
import type { BillingPeriod, Plan, PlanCategory, TreadmillOption } from './Plan';

/** The price list of one category and treadmill option. */
export class Rate {
  constructor(
    readonly category: PlanCategory,
    readonly treadmill: TreadmillOption,
    readonly monthly: Money,
    readonly semiMonthly: Money,
    readonly daily: Money,
  ) {}

  priceFor(period: BillingPeriod): Money {
    switch (period) {
      case 'Monthly':
        return this.monthly;
      case 'Semi-Monthly':
        return this.semiMonthly;
      case 'Daily':
        return this.daily;
    }
  }

  matches(plan: Plan): boolean {
    return this.category === plan.category && this.treadmill === plan.treadmill;
  }

  amounts(): Money[] {
    return [this.monthly, this.semiMonthly, this.daily];
  }
}

/** The set of official rates. Answers "what does this plan cost?" and "is this amount official?". */
export class RateBook {
  private constructor(private readonly rates: readonly Rate[]) {}

  static of(rates: readonly Rate[]): RateBook {
    if (rates.length === 0) throw new ValidationError('A rate book needs at least one rate.');
    return new RateBook([...rates]);
  }

  /** NeoFit's current official rates. */
  static neofitDefault(): RateBook {
    const r = (c: PlanCategory, t: TreadmillOption, m: number, s: number, d: number) =>
      new Rate(c, t, Money.pesos(m), Money.pesos(s), Money.pesos(d));
    return RateBook.of([
      r('Regular Plan', 'No Treadmill', 700, 350, 70),
      r('Regular Plan', 'With Treadmill', 900, 450, 90),
      r('Student/Senior Plan', 'No Treadmill', 600, 300, 60),
      r('Student/Senior Plan', 'With Treadmill', 800, 400, 80),
    ]);
  }

  all(): readonly Rate[] {
    return this.rates;
  }

  priceOf(plan: Plan): Money | undefined {
    return this.rates.find((r) => r.matches(plan))?.priceFor(plan.period);
  }

  /** Every distinct official amount, ascending. */
  validAmounts(): number[] {
    const all = this.rates.flatMap((r) => r.amounts().map((m) => m.pesos));
    return [...new Set(all)].sort((a, b) => a - b);
  }

  isOfficialAmount(pesos: number): boolean {
    return this.validAmounts().includes(pesos);
  }
}
