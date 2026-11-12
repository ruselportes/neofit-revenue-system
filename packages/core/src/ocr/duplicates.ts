import { LogbookEntry } from '../domain';

/** Marks entries whose name and amount appear more than once, so the user can check them. */
export function flagDuplicates(entries: readonly LogbookEntry[]): LogbookEntry[] {
  const key = (e: LogbookEntry) => `${e.name.toLowerCase()}|${e.amount?.pesos}`;
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
  return entries.map((e) => e.markDuplicate(e.hasAmount && (counts.get(key(e)) ?? 0) > 1));
}
