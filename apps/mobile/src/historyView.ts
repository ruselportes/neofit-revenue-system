import { dateOfIso, shiftDate } from './format';

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
