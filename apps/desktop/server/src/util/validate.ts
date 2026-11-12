import { ValidationError } from '@neofit/core';
import { isDateText } from './dates';

/** Reads and checks fields of a request body. Every failure is a ValidationError (HTTP 400). */
export class Body {
  private readonly data: Record<string, unknown>;

  constructor(raw: unknown) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ValidationError('Request body must be a JSON object.');
    }
    this.data = raw as Record<string, unknown>;
  }

  has(key: string): boolean {
    return this.data[key] !== undefined;
  }

  string(key: string, max: number): string {
    const v = this.data[key];
    if (typeof v !== 'string' || v.trim().length === 0) throw new ValidationError(`${key} is required.`);
    return this.limit(key, v.trim(), max);
  }

  optionalString(key: string, max: number): string | undefined {
    const v = this.data[key];
    if (v === undefined || v === null) return undefined;
    if (typeof v !== 'string') throw new ValidationError(`${key} must be text.`);
    return this.limit(key, v.trim(), max);
  }

  optionalEmail(key: string): string | null | undefined {
    const v = this.optionalString(key, 255);
    if (v === undefined) return undefined;
    if (v === '') return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ValidationError(`${key} is not a valid email address.`);
    return v;
  }

  optionalDate(key: string): string | undefined {
    const v = this.data[key];
    if (v === undefined || v === null || v === '') return undefined;
    if (!isDateText(v)) throw new ValidationError(`${key} must be a date in the form YYYY-MM-DD.`);
    return v;
  }

  optionalNumber(key: string): number | undefined {
    const v = this.data[key];
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(`${key} must be a number.`);
    return v;
  }

  array(key: string): unknown[] {
    const v = this.data[key];
    if (!Array.isArray(v)) throw new ValidationError(`${key} must be a list.`);
    return v;
  }

  private limit(key: string, value: string, max: number): string {
    if (value.length > max) throw new ValidationError(`${key} is too long (maximum ${max} characters).`);
    return value;
  }
}

export function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid id.');
  return id;
}
