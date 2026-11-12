/**
 * One CSV cell. Quotes are doubled and cells with a comma, quote or line break are quoted.
 * A cell that starts with = + - or @ gets a leading apostrophe, so a spreadsheet never runs it as a formula
 * (a staff member's name is typed text and ends up in the owner's exported file).
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
