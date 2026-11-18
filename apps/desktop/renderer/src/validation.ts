/**
 * Input rules for the forms. The local API checks the same rules again (server/src/util/validate.ts), so a rule here is
 * a convenience for the admin, not the only protection.
 */

/** Keeps only what a person's name may contain: letters of any language, spaces and . ' - (digits and symbols are dropped as typed). */
export function cleanName(text: string): string {
  return text.replace(/[^\p{L}\p{M} .'’-]/gu, '');
}

/** Keeps only what a phone number may contain: digits, spaces, dashes, brackets and a + at the start (letters are dropped as typed). */
export function cleanContact(text: string): string {
  const kept = text.replace(/[^0-9 ()+-]/g, '');
  return kept.replace(/(?!^)\+/g, ''); // a + only at the very start
}

/** The problem with a name as text, or null when it is fine. */
export function nameProblem(name: string): string | null {
  const value = name.trim();
  if ((value.match(/\p{L}/gu)?.length ?? 0) < 2) return 'Enter the full name (at least 2 letters).';
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(value)) return "The name can only have letters, spaces and . ' - (no numbers or symbols).";
  return null;
}

/** The problem with a contact number as text, or null when it is fine. */
export function contactProblem(contact: string): string | null {
  const value = contact.trim();
  if (!/^[+(]?[0-9][0-9 ()-]*$/.test(value)) return 'The contact number can only have digits, spaces, dashes and brackets.';
  const digits = value.replace(/\D/g, '').length;
  if (digits < 7 || digits > 15) return 'The contact number must have 7 to 15 digits (for example 0917 123 4567).';
  return null;
}

/** True when the month has not started yet. Used to stop the month arrows at the current month. */
export function isFutureMonth(year: number, month: number, now = new Date()): boolean {
  return year * 12 + month > now.getFullYear() * 12 + (now.getMonth() + 1);
}
