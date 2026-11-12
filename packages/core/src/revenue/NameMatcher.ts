/**
 * Decides whether a handwritten logbook name and a member-record name are the same person.
 * Two names match when, after trimming extra spaces and ignoring case, they are equal,
 * one contains the other, or their Levenshtein distance is at most 2 or 30% of the longer name.
 */
export class NameMatcher {
  constructor(private readonly maxRelativeDistance = 0.3) {}

  matches(a: string, b: string): boolean {
    const x = NameMatcher.normalize(a);
    const y = NameMatcher.normalize(b);
    if (x.length === 0 || y.length === 0) return false;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    const allowed = Math.max(2, Math.floor(Math.max(x.length, y.length) * this.maxRelativeDistance));
    return NameMatcher.levenshtein(x, y) <= allowed;
  }

  static normalize(name: string): string {
    return (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** Number of single-letter changes needed to turn `a` into `b`. */
  static levenshtein(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
      }
      previous = current;
    }
    return previous[b.length] ?? 0;
  }
}
