import { describe, expect, it } from 'vitest';
import { dateTile, groupPages, isToday, summarize, type PageItem } from '../src/historyView';

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
