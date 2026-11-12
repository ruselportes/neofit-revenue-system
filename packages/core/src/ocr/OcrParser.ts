import { LogbookEntry } from '../domain';
import { flagDuplicates } from './duplicates';

/**
 * Turns raw OCR text into logbook entries.
 * Handles "Maria - 120", "Carl 100", "John", "Anna-80", "Dimple - 20 - G-Cash".
 */
export class OcrParser {
  private static readonly PAYMENT_TAG = /[\-–—\s]+(G-?Cash|Cash|GC)\s*$/i;
  private static readonly PAYMENT_TAG_ANY = /[\-–—\s]+(G-?Cash|Cash|GC)/gi;
  private static readonly AMOUNT_CHARS = '[0-9OoQDIl|!iSsBZz]';
  private static readonly SEPARATED = new RegExp(
    `^(.+?)\\s*[:=\\-–—\\s]\\s*(?:₱|P|PHP)?\\s*(${OcrParser.AMOUNT_CHARS}+(?:\\.${OcrParser.AMOUNT_CHARS}{1,2})?)(?:[\\-–—\\s]+.*)?$`,
    'i',
  );
  private static readonly TRAILING = new RegExp(`^(.+?)\\s+(?:₱|P|PHP)?\\s*(${OcrParser.AMOUNT_CHARS}+)$`, 'i');

  parse(rawText: string): LogbookEntry[] {
    const entries = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .flatMap((line) => {
        const entry = this.parseLine(line);
        return entry ? [entry] : [];
      });
    return flagDuplicates(entries);
  }

  private parseLine(rawLine: string): LogbookEntry | null {
    if (rawLine.length < 2) return null;

    const line = rawLine
      .replace(/^(?:\d+[.)]|#\d+|\*|-)\s*/, '')
      .replace(OcrParser.PAYMENT_TAG, '')
      .trim();
    if (line.length < 2) return null;

    for (const pattern of [OcrParser.SEPARATED, OcrParser.TRAILING]) {
      const match = line.match(pattern);
      if (!match) continue;
      const name = this.cleanName(match[1] ?? '');
      const amount = this.readAmount(match[2] ?? '');
      if (name.length >= 2 && amount !== null) {
        return new LogbookEntry(this.capitalize(name), amount, rawLine);
      }
    }

    const nameOnly = this.cleanName(line.replace(OcrParser.PAYMENT_TAG_ANY, '')).replace(/^\d+\s+/, '');
    if (nameOnly.length >= 2 && /[A-Za-z]/.test(nameOnly)) {
      return new LogbookEntry(this.capitalize(nameOnly), null, rawLine);
    }
    return null;
  }

  private cleanName(text: string): string {
    return text
      .replace(OcrParser.PAYMENT_TAG_ANY, '')
      .replace(/[^A-Za-z0-9\s.'\-()]/g, '')
      .trim();
  }

  /** Fixes common digit misreadings: "1O0" -> 100, "S00" -> 500. Returns null if no sensible amount. */
  private readAmount(raw: string): number | null {
    if (!/[0-9₱P]/i.test(raw)) return null;
    const cleaned = raw
      .replace(/[₱Pp]/g, '')
      .replace(/[/\-+=;,)]/g, '')
      .trim()
      .replace(/[OoQD]/g, '0')
      .replace(/[Il|!i]/g, '1')
      .replace(/[Ss]/g, '5')
      .replace(/B/g, '8')
      .replace(/[Zz]/g, '2');
    const value = parseFloat(cleaned);
    return Number.isNaN(value) || value <= 0 || value >= 1_000_000 ? null : value;
  }

  private capitalize(text: string): string {
    return text
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

}
