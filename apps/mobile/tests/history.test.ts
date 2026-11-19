import { describe, expect, it } from 'vitest';
import { dateTile, emptyText, filterPages, groupPages, activityText, historySub, initialsOf, isToday, lastSyncedText, latestSync, staffActivity, summarize, syncedAtText, type PageItem } from '../src/historyView';

const page = (id: string, date: string, total: number, entries = 2, synced = true, time = `${date}T09:15:00`): PageItem => ({ id, date, entries, total, time, synced });
const TODAY = '2026-11-19';

describe('summary tiles', () => {
  it('adds up the total, pages and entries, and counts pages that are still waiting', () => {
    const s = summarize([page('a', TODAY, 630, 3), page('b', '2026-11-18', 40, 2, false), page('c', '2026-11-14', 1600, 2)]);
    expect(s).toEqual({ total: 2270, pages: 3, entries: 7, waiting: 1 });
  });

  it('is all zeros for an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, pages: 0, entries: 0, waiting: 0 });
  });
});

describe('grouping by day, week and month', () => {
  const list = [
    page('1', '2026-11-19', 630),
    page('2', '2026-11-19', 70),
    page('3', '2026-11-18', 40),
    page('4', '2026-11-17', 200), // 2 days back: earlier this week
    page('5', '2026-11-13', 10), // exactly 6 days back: earlier this week
    page('6', '2026-11-12', 1600), // 7 days back: earlier in the month
    page('7', '2026-11-02', 5),
    page('8', '2026-10-30', 300), // another month
    page('9', '2026-10-01', 100),
    page('10', '2025-12-31', 50), // another year
  ];
  const groups = groupPages(list, TODAY);

  it('makes the groups in order, newest first', () => {
    expect(groups.map((g) => g.title)).toEqual(['Today', 'Yesterday', 'Earlier this week', 'Earlier in November', 'October 2026', 'December 2025']);
  });

  it('puts each page in the right group and totals each group', () => {
    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g]));
    expect(byTitle['Today']).toMatchObject({ total: 700, pages: 2 });
    expect(byTitle['Yesterday']).toMatchObject({ total: 40, pages: 1 });
    expect(byTitle['Earlier this week']!.items.map((i) => i.id)).toEqual(['4', '5']);
    expect(byTitle['Earlier in November']).toMatchObject({ total: 1605, pages: 2 });
    expect(byTitle['October 2026']).toMatchObject({ total: 400, pages: 2 });
    expect(byTitle['December 2025']).toMatchObject({ total: 50, pages: 1 });
  });

  it('keeps every page exactly once', () => {
    expect(groups.flatMap((g) => g.items).length).toBe(list.length);
    expect(groups.reduce((s, g) => s + g.total, 0)).toBe(list.reduce((s, i) => s + i.total, 0));
  });

  it('works across a month boundary (the 1st of a month)', () => {
    const g = groupPages([page('a', '2026-12-01', 1), page('b', '2026-11-30', 2), page('c', '2026-11-27', 3), page('d', '2026-11-20', 4)], '2026-12-01');
    expect(g.map((x) => x.title)).toEqual(['Today', 'Yesterday', 'Earlier this week', 'November 2026']);
  });
});

describe('row details', () => {
  it('makes the date tile', () => {
    expect(dateTile('2026-11-19')).toEqual({ day: '19', month: 'NOV' });
    expect(dateTile('2026-01-05')).toEqual({ day: '5', month: 'JAN' });
  });

  it('counts a page as today when its logbook date or its saved time is today', () => {
    expect(isToday(page('a', TODAY, 1), TODAY)).toBe(true);
    expect(isToday(page('b', '2026-11-18', 1, 1, false, '2026-11-19T08:00:00'), TODAY)).toBe(true); // written yesterday, saved today
    expect(isToday(page('c', '2026-11-18', 1), TODAY)).toBe(false);
  });
});

describe('period chips', () => {
  const list = [
    page('1', '2026-11-19', 1),
    page('2', '2026-11-18', 2),
    page('3', '2026-11-13', 3), // 6 days back: still in the week
    page('4', '2026-11-12', 4), // 7 days back: this month, not this week
    page('5', '2026-11-01', 5),
    page('6', '2026-10-31', 6),
    page('7', '2026-11-20', 7, 1, false, '2026-11-19T10:00:00'), // logbook date tomorrow-ish but saved today
  ];
  const ids = (r: 'today' | 'week' | 'month' | 'all') => filterPages(list, r, TODAY).map((i) => i.id);

  it('Today: the logbook date or the saved time is today', () => {
    expect(ids('today')).toEqual(['1', '7']);
  });
  it('Week: the last 7 days, today included', () => {
    expect(ids('week')).toEqual(['1', '2', '3']);
  });
  it('Month: this calendar month', () => {
    expect(ids('month')).toEqual(['1', '2', '3', '4', '5', '7']);
  });
  it('All: everything, in the same order', () => {
    expect(ids('all')).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
  it('says what an empty list means for each period', () => {
    expect(emptyText('today').title).toBe('No pages scanned today');
    expect(emptyText('week').title).toBe('No pages in the last 7 days');
    expect(emptyText('month').title).toBe('No pages this month');
    expect(emptyText('all').title).toBe('No pages yet');
  });
});

describe('the line under the staff History title', () => {
  it('shows when it last synced, with the date when it was not today', () => {
    expect(lastSyncedText('2026-11-19T09:15:00', TODAY)).toBe('Last synced 9:15 AM');
    expect(lastSyncedText('2026-11-18T21:05:00', TODAY)).toBe('Last synced Nov 18, 2026, 9:05 PM');
    expect(lastSyncedText(null, TODAY)).toBe('Not synced yet');
  });
  it('puts waiting pages first, because those need attention', () => {
    expect(historySub(0, '2026-11-19T09:15:00', TODAY)).toBe('Last synced 9:15 AM');
    expect(historySub(1, '2026-11-19T09:15:00', TODAY)).toBe('1 page is waiting to upload · pull down to sync');
    expect(historySub(3, null, TODAY)).toBe('3 pages are waiting to upload · pull down to sync');
  });
});

describe('when a page last reached the cloud', () => {
  it('uses the newest synced page when the phone saved no time (pages saved while online skip the queue)', () => {
    const items = [page('a', TODAY, 1, 1, true, '2026-11-19T09:15:00'), page('b', '2026-11-18', 2, 1, true, '2026-11-18T20:00:00')];
    expect(latestSync(null, items)).toBe('2026-11-19T09:15:00');
    expect(historySub(0, latestSync(null, items), TODAY)).toBe('Last synced 9:15 AM'); // not "Not synced yet"
  });
  it('uses the saved time when it is newer than every page', () => {
    expect(latestSync('2026-11-19T11:00:00', [page('a', TODAY, 1, 1, true, '2026-11-19T09:15:00')])).toBe('2026-11-19T11:00:00');
  });
  it('ignores pages that are still waiting, and a time that is not a date', () => {
    expect(latestSync('not a date', [page('a', TODAY, 1, 1, false, '2026-11-19T10:00:00')])).toBeNull();
    expect(latestSync(null, [])).toBeNull();
  });
});

describe('people on the Staff tab and Account screen', () => {
  it('makes the initials for a tile', () => {
    expect(initialsOf('Ana Reyes')).toBe('AR');
    expect(initialsOf('  carlo  santos  jr ')).toBe('CJ'); // first and last word
    expect(initialsOf('Carlo')).toBe('C');
    expect(initialsOf('Niño Peña')).toBe('NP');
    expect(initialsOf('   ')).toBe('?');
  });

  it('adds up what each person uploaded, and when they last did', () => {
    const pages = [
      { staffId: 'a', date: '2026-11-18' },
      { staffId: 'a', date: '2026-11-02' },
      { staffId: 'a', date: '2026-10-30' },
      { staffId: 'b', date: '2026-09-01' },
    ];
    const m = staffActivity(pages, TODAY);
    expect(m.get('a')).toEqual({ lastDate: '2026-11-18', thisMonth: 2 });
    expect(m.get('b')).toEqual({ lastDate: '2026-09-01', thisMonth: 0 });
    expect(m.get('nobody')).toBeUndefined();
  });

  it('writes it as a muted line', () => {
    expect(activityText({ lastDate: '2026-11-18', thisMonth: 4 }, TODAY)).toBe('Last upload Nov 18 · 4 pages this month');
    expect(activityText({ lastDate: '2026-09-01', thisMonth: 1 }, TODAY)).toBe('Last upload Sep 1 · 1 page this month');
    expect(activityText({ lastDate: '2025-12-31', thisMonth: 0 }, TODAY)).toBe('Last upload Dec 31, 2025 · 0 pages this month');
    expect(activityText(undefined, TODAY)).toBe('No uploads yet');
  });

  it('writes a sync time with the date only when it was not today', () => {
    expect(syncedAtText('2026-11-19T09:15:00', TODAY)).toBe('9:15 AM');
    expect(syncedAtText('2026-11-18T21:05:00', TODAY)).toBe('Nov 18, 2026, 9:05 PM');
  });
});
