import {
  MemberPayment,
  Money,
  PlanParser,
  RevenueEngine,
  ValidationError,
  type DateRange,
  type IRevenueDataSource,
  type LogbookRecord,
  type MonthlyRevenue,
} from '@neofit/core';
import type { PaymentRepository } from '../repositories/PaymentRepository';

/** Where synced logbook pages come from. The Supabase adapter implements this in a later phase. */
export interface ILogbookRecords {
  logbookRecords(range: DateRange): Promise<LogbookRecord[]>;
  /** True when the last read could not reach the cloud, so logbook figures may be missing or old. */
  isStale?(): boolean;
}

/** Used until the cloud logbook is connected: no pages. */
export class EmptyLogbookRecords implements ILogbookRecords {
  async logbookRecords(): Promise<LogbookRecord[]> {
    return [];
  }
}

/** Logbook pages from the cloud, member payments from SQLite. */
export class CompositeRevenueSource implements IRevenueDataSource {
  constructor(
    private readonly logbook: ILogbookRecords,
    private readonly payments: PaymentRepository,
  ) {}

  logbookRecords(range: DateRange): Promise<LogbookRecord[]> {
    return this.logbook.logbookRecords(range);
  }

  async memberPayments(range: DateRange): Promise<MemberPayment[]> {
    return this.payments
      .inRange(range.start, range.end)
      .map((p) => new MemberPayment(p.id, p.memberName, Money.pesos(p.amount), p.paidAt.slice(0, 10), PlanParser.parse(p.plan)));
  }
}

export interface RevenueReport {
  /** True when the logbook could not be refreshed from the cloud, so its figures may be missing or old. */
  logbookStale: boolean;
  year: number;
  month: number;
  total: number;
  logbookTotal: number;
  paymentsTotal: number;
  yearTotal: number;
  days: Array<{
    date: string;
    logbook: number;
    logbookCount: number;
    payments: number;
    paymentCount: number;
    total: number;
  }>;
  byCategory: Array<{ category: string; revenue: number }>;
  previous: { year: number; month: number; total: number; changePesos: number; changePercent: number | null };
}

export class RevenueService {
  constructor(
    private readonly engine: RevenueEngine,
    private readonly logbook?: ILogbookRecords,
  ) {}

  async report(year: number, month: number): Promise<RevenueReport> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new ValidationError('Invalid year.');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new ValidationError('Invalid month.');

    const [comparison, yearTotal] = await Promise.all([
      this.engine.compareWithPrevious(year, month),
      this.engine.year(year),
    ]);
    const { current, previous } = comparison;
    return {
      logbookStale: this.logbook?.isStale?.() ?? false,
      year,
      month,
      total: current.total.pesos,
      logbookTotal: current.logbookTotal.pesos,
      paymentsTotal: current.paymentsTotal.pesos,
      yearTotal: yearTotal.pesos,
      days: this.days(current),
      byCategory: [...current.byCategory].map(([category, revenue]) => ({ category, revenue: revenue.pesos })).sort((a, b) => b.revenue - a.revenue),
      previous: {
        year: previous.year,
        month: previous.month,
        total: previous.total.pesos,
        changePesos: comparison.changePesos,
        changePercent: comparison.changePercent,
      },
    };
  }

  private days(m: MonthlyRevenue): RevenueReport['days'] {
    return m.days.map((d) => ({
      date: d.date,
      logbook: d.logbook.pesos,
      logbookCount: d.logbookCount,
      payments: d.payments.pesos,
      paymentCount: d.paymentCount,
      total: d.total.pesos,
    }));
  }
}
