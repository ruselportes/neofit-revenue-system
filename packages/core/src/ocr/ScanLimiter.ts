import { type IClock, type IKeyValueStore, SystemClock } from './ports';

export interface ScanUsage {
  readonly used: number;
  readonly remaining: number;
  readonly limit: number;
  readonly resetHour: number;
}

interface StoredUsage {
  period: string;
  count: number;
}

/**
 * Limits online scans per day. The day runs from the reset hour (8:00 AM) to the
 * next one, not midnight. Every attempt counts, even a failed one, because a failed
 * call still uses the API quota.
 */
export class ScanLimiter {
  static readonly STORAGE_KEY = 'neofit_online_scan_count';

  constructor(
    private readonly store: IKeyValueStore,
    private readonly clock: IClock = new SystemClock(),
    readonly limit = 5,
    readonly resetHour = 8,
  ) {}

  async usage(): Promise<ScanUsage> {
    return this.toUsage((await this.load()).count);
  }

  async canScan(): Promise<boolean> {
    return (await this.usage()).remaining > 0;
  }

  async consume(): Promise<ScanUsage> {
    const stored = await this.load();
    const count = Math.min(this.limit, stored.count + 1);
    await this.store.setItem(ScanLimiter.STORAGE_KEY, JSON.stringify({ period: stored.period, count }));
    return this.toUsage(count);
  }

  formatResetTime(): string {
    const h = this.resetHour % 12;
    return `${h === 0 ? 12 : h}:00 ${this.resetHour >= 12 ? 'PM' : 'AM'}`;
  }

  private toUsage(count: number): ScanUsage {
    return {
      used: count,
      remaining: Math.max(0, this.limit - count),
      limit: this.limit,
      resetHour: this.resetHour,
    };
  }

  private currentPeriod(): string {
    const d = new Date(this.clock.now());
    if (d.getHours() < this.resetHour) d.setDate(d.getDate() - 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private async load(): Promise<StoredUsage> {
    const period = this.currentPeriod();
    try {
      const raw = await this.store.getItem(ScanLimiter.STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredUsage>) : null;
      if (parsed && parsed.period === period && typeof parsed.count === 'number') {
        return { period, count: parsed.count };
      }
    } catch {
      // unreadable storage counts as a fresh day
    }
    return { period, count: 0 };
  }
}
