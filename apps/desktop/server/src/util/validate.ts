import { ValidationError } from '@neofit/core';
import { isDateText } from './dates';

/**
 * A person's name: letters of any language, spaces, and . ' - (as in "Dela Cruz Jr.", "O'Neil", "Ma-an"). No digits or symbols.
 * Returns the problem as text, or null when the name is fine. The desktop screen uses the same rule (renderer/src/validation.ts).
 */
export function nameProblem(name: string): string | null {
  const letters = name.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 2) return 'Name must have at least 2 letters.';
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) return 'Name can only have letters, spaces and . \' - (no numbers or symbols).';
  return null;
}

/**
 * A contact number: digits, with an optional leading + and spaces, dashes or brackets between them (09171234567,
 * +63 917 123 4567, (082) 123-4567). Between 7 and 15 digits. No letters.
 */
export function contactProblem(contact: string): string | null {
  if (!/^[+(]?[0-9][0-9 ()-]*$/.test(contact)) return 'Contact number can only have digits, spaces, dashes and brackets (and a + at the start).';
  const digits = contact.replace(/\D/g, '').length;
  if (digits < 7 || digits > 15) return 'Contact number must have 7 to 15 digits.';
  return null;
}

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

  /** A required person name (see nameProblem). */
  personName(key: string, max: number): string {
    const v = this.string(key, max).replace(/\s+/g, ' '); // "Ian   Reyes" is stored as "Ian Reyes"
    const problem = nameProblem(v);
    if (problem) throw new ValidationError(problem);
    return v;
  }

  /** A required contact number (see contactProblem). */
  contactNumber(key: string, max: number): string {
    const v = this.string(key, max);
    const problem = contactProblem(v);
    if (problem) throw new ValidationError(problem);
    return v;
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

  /** An email address that must be given: members sign in to the app with it. */
  email(key: string): string {
    const v = this.optionalEmail(key);
    if (!v) throw new ValidationError("Enter the member's email address.");
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
