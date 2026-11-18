import { describe, expect, it } from 'vitest';
import { cleanContact, cleanName, contactProblem, isFutureMonth, nameProblem } from '../src/validation';

describe('typing is filtered', () => {
  it('drops digits and symbols from a name but keeps letters of any language', () => {
    expect(cleanName('123425')).toBe('');
    expect(cleanName('Ian 2nd')).toBe('Ian nd');
    expect(cleanName("Juan Dela Cruz Jr., O'Neil-Peña Niño")).toBe("Juan Dela Cruz Jr., O'Neil-Peña Niño".replace(',', ''));
    expect(cleanName('Rose@home_1')).toBe('Rosehome');
  });

  it('drops letters from a contact number but keeps + ( ) - and spaces', () => {
    expect(cleanContact('asdfad')).toBe('');
    expect(cleanContact('0917abc 123-4567')).toBe('0917 123-4567');
    expect(cleanContact('+63 (917) 123 4567')).toBe('+63 (917) 123 4567');
    expect(cleanContact('09+17+')).toBe('0917'); // a + only at the start
    expect(cleanContact('+63+917')).toBe('+63917');
  });
});

describe('the same rules as the server', () => {
  it('accepts normal names and numbers', () => {
    for (const n of ['Ian', 'Rose Garcia', 'Dr. Niño Peña', "Shaquille O'Neil"]) expect(nameProblem(n)).toBeNull();
    for (const c of ['09171234567', '+63 917 123 4567', '(082) 123-4567']) expect(contactProblem(c)).toBeNull();
  });

  it('refuses what the screenshot showed: a number as a name, letters as a contact', () => {
    expect(nameProblem('123425')).toMatch(/at least 2 letters/);
    expect(nameProblem('Ian 2')).toMatch(/no numbers/);
    expect(contactProblem('asdfad')).toMatch(/digits/);
    expect(contactProblem('0917')).toMatch(/7 to 15 digits/);
  });
});

describe('months stop at the current one', () => {
  const now = new Date(2026, 10, 18); // 18 Nov 2026
  it('knows which months have not started', () => {
    expect(isFutureMonth(2026, 11, now)).toBe(false);
    expect(isFutureMonth(2026, 12, now)).toBe(true);
    expect(isFutureMonth(2027, 7, now)).toBe(true);
    expect(isFutureMonth(2026, 10, now)).toBe(false);
    expect(isFutureMonth(2025, 12, now)).toBe(false);
  });
});
