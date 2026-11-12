import { ValidationError } from '../errors';
import { Money } from './Money';

export interface LogbookEntryJSON {
  name: string;
  amount: number | null;
  originalText: string;
  isDuplicate: boolean;
}

/** One logbook line: a member name and the amount paid. Immutable; edits return a new entry. */
export class LogbookEntry {
  readonly amount: Money | null;

  constructor(
    readonly name: string,
    amount: Money | number | null,
    readonly originalText: string = '',
    readonly isDuplicate: boolean = false,
  ) {
    if (name.trim().length === 0) throw new ValidationError('Entry name is required.');
    this.amount = typeof amount === 'number' ? Money.pesos(amount) : amount;
  }

  get hasAmount(): boolean {
    return this.amount !== null;
  }

  withName(name: string): LogbookEntry {
    return new LogbookEntry(name, this.amount, this.originalText, this.isDuplicate);
  }

  withAmount(amount: Money | number | null): LogbookEntry {
    return new LogbookEntry(this.name, amount, this.originalText, this.isDuplicate);
  }

  markDuplicate(isDuplicate: boolean): LogbookEntry {
    return new LogbookEntry(this.name, this.amount, this.originalText, isDuplicate);
  }

  toJSON(): LogbookEntryJSON {
    return {
      name: this.name,
      amount: this.amount ? this.amount.pesos : null,
      originalText: this.originalText,
      isDuplicate: this.isDuplicate,
    };
  }

  static fromJSON(json: LogbookEntryJSON): LogbookEntry {
    return new LogbookEntry(json.name, json.amount, json.originalText, json.isDuplicate);
  }

  /** Total of the entries that have an amount. */
  static total(entries: readonly LogbookEntry[]): Money {
    return Money.sum(entries.flatMap((e) => (e.amount ? [e.amount] : [])));
  }
}
