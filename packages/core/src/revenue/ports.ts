import type { LogbookEntry, MemberPayment, Money } from '../domain';

export interface DateRange {
  /** First day, YYYY-MM-DD. */
  readonly start: string;
  /** Last day, YYYY-MM-DD, inclusive. */
  readonly end: string;
}

/** A synced logbook page as the revenue engine sees it. */
export interface LogbookRecord {
  readonly date: string;
  readonly totalAmount: Money;
  readonly entryCount: number;
  readonly entries: readonly LogbookEntry[];
}

/** Where the engine reads its figures from. The desktop implements it over Supabase and SQLite. */
export interface IRevenueDataSource {
  logbookRecords(range: DateRange): Promise<LogbookRecord[]>;
  memberPayments(range: DateRange): Promise<MemberPayment[]>;
}
