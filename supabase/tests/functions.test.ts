import { describe, expect, it } from 'vitest';
import {
  buildReminder,
  chunk,
  daysLeft,
  dueExpiryDates,
  manilaToday,
  readTickets,
  type DueAccount,
} from '../functions/_shared/reminders';
import { isAlreadyRegistered, mayManageMembers, parseAccessRequest } from '../functions/_shared/access';

const account = (over: Partial<DueAccount> = {}): DueAccount => ({
  id: 'a1',
  plan: 'Regular Plan - Monthly (No Treadmill)',
  expiry_date: '2026-11-11',
  push_token: 'ExponentPushToken[abc]',
  last_reminder_on: null,
  ...over,
});

describe('Philippine date', () => {
  it('is already tomorrow in Manila at 18:00 UTC', () => {
    expect(manilaToday(new Date('2026-11-04T18:00:00Z'))).toBe('2026-11-05');
  });
  it('is still the same day at 15:59 UTC', () => {
    expect(manilaToday(new Date('2026-11-04T15:59:00Z'))).toBe('2026-11-04');
  });
  it('is 8:00 AM in Manila at 00:00 UTC, when pg_cron runs', () => {
    expect(manilaToday(new Date('2026-11-04T00:00:00Z'))).toBe('2026-11-04');
  });
});

describe('reminder days', () => {
  it('counts days left', () => {
    expect(daysLeft('2026-11-04', '2026-11-11')).toBe(7);
    expect(daysLeft('2026-12-30', '2027-01-02')).toBe(3);
  });
  it('lists the expiry dates that are due today', () => {
    expect(dueExpiryDates('2026-11-04')).toEqual(['2026-11-11', '2026-11-07', '2026-11-05']);
  });
});

describe('reminder messages (Table 26.0)', () => {
  const today = '2026-11-04';
  it('7 days', () => {
    expect(buildReminder(account({ expiry_date: '2026-11-11' }), today)).toMatchObject({
      to: 'ExponentPushToken[abc]',
      title: 'Your membership expires in 7 days',
      body: 'Your plan ends on Nov 11, 2026. Renew at the front desk on your next visit.',
      data: { screen: 'home' },
    });
  });
  it('3 days names the plan and the weekday', () => {
    expect(buildReminder(account({ expiry_date: '2026-11-07' }), today)).toMatchObject({
      title: 'Your membership expires in 3 days',
      body: 'Your Regular Plan - Monthly (No Treadmill) plan ends on Saturday, Nov 7, 2026. Renew at the NeoFit front desk to keep it active.',
    });
  });
  it('1 day', () => {
    expect(buildReminder(account({ expiry_date: '2026-11-05' }), today)).toMatchObject({
      title: 'Your membership expires tomorrow',
      body: 'Your plan ends tomorrow, Nov 5, 2026. Renew at the NeoFit front desk to keep it active.',
    });
  });
  it('sends nothing on other days, without a token, or twice on one day', () => {
    expect(buildReminder(account({ expiry_date: '2026-11-09' }), today)).toBeNull();
    expect(buildReminder(account({ push_token: '' }), today)).toBeNull();
    expect(buildReminder(account({ last_reminder_on: today }), today)).toBeNull();
  });
});

describe('push results', () => {
  it('marks accepted messages and flags tokens that are no longer valid', () => {
    const outcome = readTickets(['a', 'b', 'c', 'd'], [
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
      { status: 'ok' },
    ]);
    expect(outcome).toEqual({ sent: ['a', 'd'], invalidTokens: ['b'] });
  });
  it('splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('member-access rules', () => {
  const id = '3f2c1c52-8a36-4c3e-9d57-0a8d9a5e1b11';
  it('accepts invite and remove for a UUID', () => {
    expect(parseAccessRequest({ action: 'invite', accountId: id })).toEqual({ ok: true, value: { action: 'invite', accountId: id } });
    expect(parseAccessRequest({ action: 'remove', accountId: id }).ok).toBe(true);
  });
  it('rejects anything else', () => {
    expect(parseAccessRequest(null).ok).toBe(false);
    expect(parseAccessRequest({ action: 'promote', accountId: id }).ok).toBe(false);
    expect(parseAccessRequest({ action: 'invite', accountId: "1'; drop table" }).ok).toBe(false);
  });
  it('lets only an active owner manage members', () => {
    expect(mayManageMembers({ role: 'owner', is_active: true })).toBe(true);
    expect(mayManageMembers({ role: 'owner', is_active: false })).toBe(false);
    expect(mayManageMembers({ role: 'staff', is_active: true })).toBe(false);
    expect(mayManageMembers(null)).toBe(false);
  });
  it('recognises an existing account', () => {
    expect(isAlreadyRegistered({ code: 'email_exists' })).toBe(true);
    expect(isAlreadyRegistered({ message: 'A user with this email address has already been registered' })).toBe(true);
    expect(isAlreadyRegistered({ message: 'rate limit' })).toBe(false);
    expect(isAlreadyRegistered(null)).toBe(false);
  });
});
