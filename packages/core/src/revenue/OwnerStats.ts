export interface UploadTotal {
  /** Logbook date, YYYY-MM-DD. */
  date: string;
  total: number;
  entries: number;
}

export interface DayRevenue {
  date: string;
  total: number;
  entries: number;
}

export interface OwnerStatsResult {
  today: number;
  todayEntries: number;
  /** From Monday of this week. */
  week: number;
  /** From the first day of this month. */
  month: number;
  /** From January 1. */
  year: number;
  /** The last seven days, oldest first, with zeros for days without uploads. */
  last7: DayRevenue[];
}

/** The four totals and the seven-day chart of the owner's Dashboard (SDD Section 4.6). */
export class OwnerStats {
  static compute(uploads: readonly UploadTotal[], today: string): OwnerStatsResult {
    const weekStart = OwnerStats.shift(today, -((OwnerStats.weekday(today) + 6) % 7));
    const monthStart = `${today.slice(0, 8)}01`;
    const yearStart = `${today.slice(0, 4)}-01-01`;

    const sumFrom = (start: string) =>
      uploads.filter((u) => u.date >= start && u.date <= today).reduce((s, u) => s + u.total, 0);

    const last7 = Array.from({ length: 7 }, (_, i) => OwnerStats.shift(today, i - 6)).map((date) => {
      const day = uploads.filter((u) => u.date === date);
      return { date, total: day.reduce((s, u) => s + u.total, 0), entries: day.reduce((s, u) => s + u.entries, 0) };
    });

    return {
      today: sumFrom(today),
      todayEntries: last7[6]!.entries,
      week: sumFrom(weekStart),
      month: sumFrom(monthStart),
      year: sumFrom(yearStart),
      last7,
    };
  }

  /** 0 = Sunday ... 6 = Saturday. */
  private static weekday(date: string): number {
    return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))).getUTCDay();
  }

  private static shift(date: string, days: number): string {
    const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + days));
    return d.toISOString().slice(0, 10);
  }
}
