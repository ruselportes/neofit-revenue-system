import { ValidationError } from '@neofit/core';
import type { RateRecord } from '../models';
import { RateRepository } from '../repositories/RateRepository';
import { Body } from '../util/validate';
import type { CloudSyncCoordinator } from './CloudSyncCoordinator';

const CATEGORIES = ['Regular Plan', 'Student/Senior Plan'];
const TYPES = ['No Treadmill', 'With Treadmill'];

/** The rate table (SDD Section 4.8). Rate changes are published to the member screens. */
export class RateService {
  constructor(
    private readonly rates: RateRepository,
    private readonly cloud: CloudSyncCoordinator,
  ) {}

  /** Puts the official rates in an empty table. Called at start-up. */
  ensureSeeded(): void {
    if (this.rates.all().length === 0) this.rates.replaceAll(RateRepository.officialDefaults());
  }

  list(): RateRecord[] {
    return this.rates.all();
  }

  async save(raw: unknown): Promise<RateRecord[]> {
    const items = new Body(raw).array('rates').map((item) => {
      const b = new Body(item);
      const rate: RateRecord = {
        category: b.string('category', 20),
        type: b.string('type', 15),
        monthly: this.price(b, 'monthly'),
        semi: this.price(b, 'semi'),
        daily: this.price(b, 'daily'),
      };
      if (!CATEGORIES.includes(rate.category)) throw new ValidationError(`Unknown category: ${rate.category}`);
      if (!TYPES.includes(rate.type)) throw new ValidationError(`Unknown type: ${rate.type}`);
      return rate;
    });
    const keys = new Set(items.map((r) => `${r.category}|${r.type}`));
    if (items.length !== CATEGORIES.length * TYPES.length || keys.size !== items.length) {
      throw new ValidationError('Send exactly one rate for each category and type (four rows).');
    }
    this.rates.replaceAll(items);
    await this.publish();
    return this.rates.all();
  }

  async reset(): Promise<RateRecord[]> {
    this.rates.replaceAll(RateRepository.officialDefaults());
    await this.publish();
    return this.rates.all();
  }

  private price(b: Body, key: string): number {
    const v = b.optionalNumber(key) ?? 0;
    if (v < 0) throw new ValidationError(`${key} cannot be negative.`);
    return v;
  }

  private publish(): Promise<void> {
    return this.cloud.record({ entity: 'rate', operation: 'upsert', entityId: 'rates', payload: undefined });
  }
}
