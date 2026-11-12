import { Money } from '../domain';
import { DailyBreakdown, MonthlyRevenue, type RevenueComparison } from './DailyBreakdown';
import { NameMatcher } from './NameMatcher';
import type { DateRange, IRevenueDataSource } from './ports';

export const LOGBOOK_CATEGORY = 'Logbook';

/**
 * Computes revenue from the two sources and counts each payment once (Table 24.0):
 * - Logbook pages: the whole total counts, on the page's date. The logbook is the primary record.
 * - Member payments: counted on their date, unless a logbook entry on that date has the member's name.
 */
export class RevenueEngine {
  constructor(
    private readonly source: IRevenueDataSource,
    private readonly names: NameMatcher = new NameMatcher(),
  ) {}

  async month(year: number, month: number): Promise<MonthlyRevenue> {
    const dates = RevenueEngine.datesOf(year, month);
    const range: DateRange = { start: dates[0]!, end: dates[dates.length - 1]! };
    const [records, payments] = await Promise.all([
      this.source.logbookRecords(range),
      this.source.memberPayments(range),
    ]);

    const days = new Map(
      dates.map((date) => [date, { logbook: Money.ZERO, logbookCount: 0, payments: Money.ZERO, paymentCount: 0 }]),
    );
    const byCategory = new Map<string, Money>();
    const add = (category: string, amount: Money) =>
      byCategory.set(category, (byCategory.get(category) ?? Money.ZERO).add(amount));
    const logbookNames = new Map<string, string[]>();

    for (const record of records) {
      const day = days.get(record.date);
      if (!day) continue;
      day.logbook = day.logbook.add(record.totalAmount);
      day.logbookCount += record.entryCount;
      if (record.totalAmount.pesos > 0) add(LOGBOOK_CATEGORY, record.totalAmount);
      const list = logbookNames.get(record.date) ?? [];
      list.push(...record.entries.map((e) => e.name));
      logbookNames.set(record.date, list);
    }

    for (const payment of payments) {
      const day = days.get(payment.date);
      if (!day) continue;
      const alreadyInLogbook = (logbookNames.get(payment.date) ?? []).some((n) =>
        this.names.matches(n, payment.memberName),
      );
      if (alreadyInLogbook) continue;
      day.payments = day.payments.add(payment.amount);
      day.paymentCount += 1;
      add(payment.plan.category, payment.amount);
    }

    return new MonthlyRevenue(
      year,
      month,
      dates.map((date) => {
        const d = days.get(date)!;
        return new DailyBreakdown(date, d.logbook, d.logbookCount, d.payments, d.paymentCount);
      }),
      byCategory,
    );
  }

  /** The year's revenue: the twelve months added up the same way. */
  async year(year: number): Promise<Money> {
    const months = await Promise.all(Array.from({ length: 12 }, (_, i) => this.month(year, i + 1)));
    return Money.sum(months.map((m) => m.total));
  }

  async compareWithPrevious(year: number, month: number): Promise<RevenueComparison> {
    const [py, pm] = month === 1 ? [year - 1, 12] : [year, month - 1];
    const [current, previous] = await Promise.all([this.month(year, month), this.month(py, pm)]);
    const changePesos = current.total.pesos - previous.total.pesos;
    const changePercent = previous.total.pesos === 0 ? null : (changePesos / previous.total.pesos) * 100;
    return { current, previous, changePesos, changePercent };
  }

  /** Every date of the month as YYYY-MM-DD. */
  static datesOf(year: number, month: number): string[] {
    const count = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    return Array.from({ length: count }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`);
  }
}
