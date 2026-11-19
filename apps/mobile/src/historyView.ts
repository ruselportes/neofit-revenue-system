import { dateOfIso, shiftDate, shortDate, timeText } from './format';

/** The period a History list is narrowed to. */
export type Range = 'today' | 'week' | 'month' | 'all';

export const RANGES: Array<{ key: Range; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
];

/** Keeps the pages that fall in the period: today, the last 7 days (today included), this calendar month, or everything. */
export function filterPages(items: PageItem[], range: Range, today: string): PageItem[] {
  if (range === 'all') return items;
  if (range === 'today') return items.filter((i) => isToday(i, today));
  if (range === 'week') {
    const start = shiftDate(today, -6);
    return items.filter((i) => i.date >= start && i.date <= today);
  }
  return items.filter((i) => i.date.slice(0, 7) === today.slice(0, 7));
}

/** What an empty list says, for the chosen period. */
export function emptyText(range: Range): { title: string; text: string } {
  const when = { today: 'today', week: 'in the last 7 days', month: 'this month', all: 'yet' }[range];
  return { title: `No pages ${range === 'today' ? 'scanned ' : ''}${when}`, text: range === 'all' ? 'Pages that are scanned and saved appear here.' : 'Pick a longer period to see older pages.' };
}

/**
 * When a page last reached the cloud: the later of the timestamp the app saved and the newest page that is already
 * synced. The saved timestamp alone is not enough: a page saved while online goes straight to the cloud and never
 * passes the offline queue, so older phones and pages have no timestamp even though they have synced.
 */
export function latestSync(stored: string | null | undefined, items: Array<{ time: string; synced: boolean }>): string | null {
  const times = [stored, ...items.filter((i) => i.synced).map((i) => i.time)].filter((t): t is string => !!t && !Number.isNaN(new Date(t).getTime()));
  return times.length === 0 ? null : times.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

/** "9:15 AM", or "Nov 18, 2026, 9:05 PM" when it was not today. */
export function syncedAtText(iso: string, today: string): string {
  const date = dateOfIso(iso);
  return date === today ? timeText(iso) : `${shortDate(date)}, ${timeText(iso)}`;
}

/** "Last synced 9:15 AM", with the date when it was not today, or "Not synced yet". */
export function lastSyncedText(iso: string | null | undefined, today: string): string {
  return iso ? `Last synced ${syncedAtText(iso, today)}` : 'Not synced yet';
}

/** Up to two capital letters for a person's tile: "Ana Reyes" is "AR", "Carlo" is "C", nothing is "?". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0]!)[0]!;
  const last = words.length > 1 ? Array.from(words[words.length - 1]!)[0]! : '';
  return (first + last).toUpperCase();
}

export interface Activity {
  /** Logbook date of the person's newest page. */
  lastDate: string;
  /** Pages they uploaded in the current calendar month. */
  thisMonth: number;
}

/** What each staff member has uploaded, from the list of pages (newest or oldest first, either works). */
export function staffActivity(pages: Array<{ staffId: string; date: string }>, today: string): Map<string, Activity> {
  const out = new Map<string, Activity>();
  for (const p of pages) {
    const a = out.get(p.staffId) ?? { lastDate: p.date, thisMonth: 0 };
    if (p.date > a.lastDate) a.lastDate = p.date;
    if (p.date.slice(0, 7) === today.slice(0, 7)) a.thisMonth += 1;
    out.set(p.staffId, a);
  }
  return out;
}

/** "Last upload Nov 18 · 4 pages this month", or "No uploads yet". */
export function activityText(a: Activity | undefined, today: string): string {
  if (!a) return 'No uploads yet';
  const when = shortDate(a.lastDate).replace(`, ${today.slice(0, 4)}`, ''); // no year for this year
  return `Last upload ${when} · ${a.thisMonth} ${a.thisMonth === 1 ? 'page' : 'pages'} this month`;
}

/** The line under the staff History title: pages that need attention come first, then when it last synced. */
export function historySub(waiting: number, lastIso: string | null | undefined, today: string): string {
  if (waiting > 0) return `${waiting} ${waiting === 1 ? 'page is' : 'pages are'} waiting to upload · pull down to sync`;
  return lastSyncedText(lastIso, today);
}

/** One page in a History list, whoever it is for. Staff see their own pages; the owner sees everyone's. */
export interface PageItem {
  id: string;
  /** Logbook date, YYYY-MM-DD. */
  date: string;
  entries: number;
  total: number;
  /** When the page was saved (an ISO date-time). */
  time: string;
  /** False while the page is still waiting on the phone to upload. */
  synced: boolean;
  /** The staff member (owner's list only). */
  who?: string | null;
}

export interface Summary {
  total: number;
  pages: number;
  entries: number;
  /** Pages still waiting to upload. */
  waiting: number;
}

/** The totals shown in the tiles at the top of a list. */
export function summarize(items: PageItem[]): Summary {
  return items.reduce<Summary>(
    (s, i) => ({ total: s.total + i.total, pages: s.pages + 1, entries: s.entries + i.entries, waiting: s.waiting + (i.synced ? 0 : 1) }),
    { total: 0, pages: 0, entries: 0, waiting: 0 },
  );
}

export interface Group {
  key: string;
  title: string;
  total: number;
  pages: number;
  items: PageItem[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Splits a newest-first list into readable groups with each group's total: Today, Yesterday, Earlier this week
 * (the days before that, up to a week back), then "Earlier in <this month>", then one group per month.
 */
export function groupPages(items: PageItem[], today: string): Group[] {
  const yesterday = shiftDate(today, -1);
  const weekStart = shiftDate(today, -6);
  const groups: Group[] = [];
  const bucket = (key: string, title: string): Group => {
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, title, total: 0, pages: 0, items: [] }));
    return g;
  };

  for (const item of items) {
    const d = item.date;
    let g: Group;
    if (d === today) g = bucket('today', 'Today');
    else if (d === yesterday) g = bucket('yesterday', 'Yesterday');
    else if (d >= weekStart && d < yesterday) g = bucket('week', 'Earlier this week');
    else {
      const month = Number(d.slice(5, 7));
      const sameMonth = d.slice(0, 7) === today.slice(0, 7);
      g = sameMonth ? bucket('month-now', `Earlier in ${MONTHS[month - 1]}`) : bucket(d.slice(0, 7), `${MONTHS[month - 1]} ${d.slice(0, 4)}`);
    }
    g.items.push(item);
    g.total += item.total;
    g.pages += 1;
  }
  return groups;
}

/** The small calendar tile on a row: "19" over "NOV". */
export function dateTile(date: string): { day: string; month: string } {
  return { day: String(Number(date.slice(8, 10))), month: MONTHS[Number(date.slice(5, 7)) - 1]!.slice(0, 3).toUpperCase() };
}

/** Whether a page belongs to today's list: its logbook date is today, or it was saved today. */
export function isToday(item: PageItem, today: string): boolean {
  return item.date === today || dateOfIso(item.time) === today;
}
