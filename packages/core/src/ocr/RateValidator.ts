import type { LogbookEntry, RateBook } from '../domain';

export type ValidationIssue = 'unofficial-amount' | 'missing-amount' | 'duplicate';

export interface EntryReview {
  readonly entry: LogbookEntry;
  readonly issues: readonly ValidationIssue[];
}

/** Flags what the user must check on the Review screen. It never changes the entries. */
export class RateValidator {
  constructor(private readonly rates: RateBook) {}

  /** True when the amount (in pesos) is one of the official rates. */
  isOfficial(pesos: number): boolean {
    return this.rates.isOfficialAmount(pesos);
  }

  review(entry: LogbookEntry): EntryReview {
    const issues: ValidationIssue[] = [];
    if (!entry.amount) issues.push('missing-amount');
    else if (!this.rates.isOfficialAmount(entry.amount.pesos)) issues.push('unofficial-amount');
    if (entry.isDuplicate) issues.push('duplicate');
    return { entry, issues };
  }

  reviewAll(entries: readonly LogbookEntry[]): EntryReview[] {
    return entries.map((e) => this.review(e));
  }

  /** True when nothing is flagged. */
  static isClean(reviews: readonly EntryReview[]): boolean {
    return reviews.every((r) => r.issues.length === 0);
  }
}
