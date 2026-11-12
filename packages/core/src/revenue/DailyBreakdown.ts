import { Money } from '../domain';

/** Revenue of one day, split by source. */
export class DailyBreakdown {
  constructor(
    readonly date: string,
    readonly logbook: Money,
    readonly logbookCount: number,
    readonly payments: Money,
    readonly paymentCount: number,
  ) {}

  get total(): Money {
    return this.logbook.add(this.payments);
  }
}

/** Revenue of one month. */
export class MonthlyRevenue {
  constructor(
    readonly year: number,
    readonly month: number,
    readonly days: readonly DailyBreakdown[],
    /** Revenue by plan category, plus "Logbook" for pages scanned from the paper logbook. */
    readonly byCategory: ReadonlyMap<string, Money>,
  ) {}

  get logbookTotal(): Money {
    return Money.sum(this.days.map((d) => d.logbook));
  }

  get paymentsTotal(): Money {
    return Money.sum(this.days.map((d) => d.payments));
  }

  get total(): Money {
    return this.logbookTotal.add(this.paymentsTotal);
  }
}

export interface RevenueComparison {
  readonly current: MonthlyRevenue;
  readonly previous: MonthlyRevenue;
  /** Current total minus previous total, in pesos (negative when revenue fell). */
  readonly changePesos: number;
  /** Change as a percentage of the previous total; null when the previous month had no revenue. */
  readonly changePercent: number | null;
}
