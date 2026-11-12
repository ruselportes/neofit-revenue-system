import { LogbookEntry, LogbookUpload, Money } from '../domain';
import { ValidationError } from '../errors';
import { flagDuplicates } from './duplicates';
import { RateValidator, type ValidationIssue } from './RateValidator';

/** One editable row on the Review screen. The name may be empty while the user types. */
export interface ReviewRow {
  readonly key: number;
  readonly name: string;
  readonly amount: number | null;
  readonly originalText: string;
}

export interface ReviewRowView extends ReviewRow {
  readonly issues: readonly ValidationIssue[];
}

/**
 * The page being reviewed (SDD Section 4.4). Immutable: every edit returns a new session, which
 * fits React state. Flags only help the user; they never block saving.
 */
export class ReviewSession {
  private constructor(
    readonly date: string,
    /** Name of the engine that read the page, for the label on the screen. */
    readonly engine: string,
    private readonly validator: RateValidator,
    private readonly all: readonly ReviewRow[],
    private readonly nextKey: number,
  ) {}

  static start(date: string, engine: string, entries: readonly LogbookEntry[], validator: RateValidator): ReviewSession {
    const rows = entries.map((e, i): ReviewRow => ({
      key: i + 1,
      name: e.name,
      amount: e.amount ? e.amount.pesos : null,
      originalText: e.originalText,
    }));
    return new ReviewSession(date, engine, validator, rows, rows.length + 1);
  }

  /** The rows with their flags. Duplicates are worked out from the current text, so editing clears a flag. */
  rows(): ReviewRowView[] {
    const named = this.all.filter((r) => r.name.trim() !== '');
    const dupKeys = new Set(
      flagDuplicates(named.map((r) => new LogbookEntry(r.name.trim(), r.amount, r.originalText)))
        .map((e, i) => (e.isDuplicate ? named[i]!.key : -1))
        .filter((k) => k !== -1),
    );
    return this.all.map((r) => {
      const issues: ValidationIssue[] = [];
      if (r.amount === null) issues.push('missing-amount');
      else if (!this.validator.isOfficial(r.amount)) issues.push('unofficial-amount');
      if (dupKeys.has(r.key)) issues.push('duplicate');
      return { ...r, issues };
    });
  }

  update(key: number, change: { name?: string; amount?: number | null }): ReviewSession {
    if (change.amount !== undefined && change.amount !== null && (!Number.isFinite(change.amount) || change.amount < 0)) {
      throw new ValidationError('Amount must be zero or more.');
    }
    return this.with(this.all.map((r) => (r.key === key ? { ...r, ...change } : r)), this.nextKey);
  }

  remove(key: number): ReviewSession {
    return this.with(this.all.filter((r) => r.key !== key), this.nextKey);
  }

  /** Adds an empty row for an entry the reader missed. */
  add(): ReviewSession {
    return this.with([...this.all, { key: this.nextKey, name: '', amount: null, originalText: '' }], this.nextKey + 1);
  }

  /** Total of the rows that will be saved (rows with a name). */
  total(): Money {
    return Money.sum(this.all.filter((r) => r.name.trim() !== '' && r.amount !== null).map((r) => Money.pesos(r.amount!)));
  }

  /** Number of rows that will be saved. */
  count(): number {
    return this.all.filter((r) => r.name.trim() !== '').length;
  }

  /** Rows without a name are left out; at least one named row is needed. */
  confirm(id: string, staffId: string): LogbookUpload {
    const named = this.all.filter((r) => r.name.trim() !== '');
    if (named.length === 0) throw new ValidationError('Add at least one entry with a name.');
    const entries = flagDuplicates(named.map((r) => new LogbookEntry(r.name.trim(), r.amount, r.originalText)));
    return new LogbookUpload(id, this.date, staffId, entries);
  }

  private with(rows: readonly ReviewRow[], nextKey: number): ReviewSession {
    return new ReviewSession(this.date, this.engine, this.validator, rows, nextKey);
  }
}
