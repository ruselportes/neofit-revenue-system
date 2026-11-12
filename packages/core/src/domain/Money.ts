import { ValidationError } from '../errors';

/** Immutable peso amount, stored in centavos so sums never drift. */
export class Money {
  static readonly ZERO = new Money(0);

  private constructor(private readonly centavos: number) {}

  static pesos(amount: number): Money {
    if (!Number.isFinite(amount)) throw new ValidationError('Amount must be a finite number.');
    if (amount < 0) throw new ValidationError('Amount cannot be negative.');
    return new Money(Math.round(amount * 100));
  }

  get pesos(): number {
    return this.centavos / 100;
  }

  add(other: Money): Money {
    return new Money(this.centavos + other.centavos);
  }

  equals(other: Money): boolean {
    return this.centavos === other.centavos;
  }

  static sum(values: readonly Money[]): Money {
    return values.reduce((total, m) => total.add(m), Money.ZERO);
  }

  format(): string {
    return `₱${this.pesos.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}
