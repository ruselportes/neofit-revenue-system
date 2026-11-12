import { Money, Rate, RateBook, type PlanCategory, type TreadmillOption } from '@neofit/core';
import type { RateRecord } from '../models';
import { Repository } from './Repository';

export class RateRepository extends Repository {
  all(): RateRecord[] {
    return this.db.prepare('SELECT category, type, monthly, semi, daily FROM rates ORDER BY id').all() as RateRecord[];
  }

  /** Replaces the whole table in one step. */
  replaceAll(rates: readonly RateRecord[]): void {
    this.database.transaction(() => {
      this.db.prepare('DELETE FROM rates').run();
      const insert = this.db.prepare(
        'INSERT INTO rates (category, type, monthly, semi, daily) VALUES (@category, @type, @monthly, @semi, @daily)',
      );
      for (const r of rates) insert.run(r);
    });
  }

  /** The official rates (Table 22.0), as plain records. */
  static officialDefaults(): RateRecord[] {
    return RateRepository.fromBook(RateBook.neofitDefault());
  }

  toRateBook(): RateBook {
    return RateBook.of(
      this.all().map(
        (r) =>
          new Rate(
            r.category as PlanCategory,
            r.type as TreadmillOption,
            Money.pesos(r.monthly),
            Money.pesos(r.semi),
            Money.pesos(r.daily),
          ),
      ),
    );
  }

  private static fromBook(book: RateBook): RateRecord[] {
    return book.all().map((r) => ({
      category: r.category,
      type: r.treadmill,
      monthly: r.monthly.pesos,
      semi: r.semiMonthly.pesos,
      daily: r.daily.pesos,
    }));
  }
}
