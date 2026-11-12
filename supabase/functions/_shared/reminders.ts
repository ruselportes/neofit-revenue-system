// Pure logic of the send-reminders function (SDD Section 4.13, Table 26.0).
// No imports and no Deno APIs, so it can be tested with Vitest.

export interface DueAccount {
  id: string;
  plan: string;
  expiry_date: string; // YYYY-MM-DD
  push_token: string;
  last_reminder_on: string | null;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { screen: 'home' };
}

/** The days before expiry on which a reminder is sent. */
export const REMINDER_DAYS = [7, 3, 1] as const;

/** Today's date in the Philippines (UTC+8, no daylight saving), as YYYY-MM-DD. */
export function manilaToday(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function daysLeft(today: string, expiry: string): number {
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** The three expiry dates that get a reminder today. */
export function dueExpiryDates(today: string): string[] {
  return REMINDER_DAYS.map((d) => new Date(Date.parse(`${today}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10));
}

function dateText(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

function weekday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
}

/** Builds the message for an account, or null when today is not a reminder day for it. */
export function buildReminder(account: DueAccount, today: string): PushMessage | null {
  if (!account.push_token || account.last_reminder_on === today) return null;
  const left = daysLeft(today, account.expiry_date);
  const date = dateText(account.expiry_date);
  const base = { to: account.push_token, sound: 'default' as const, data: { screen: 'home' as const } };

  switch (left) {
    case 7:
      return { ...base, title: 'Your membership expires in 7 days', body: `Your plan ends on ${date}. Renew at the front desk on your next visit.` };
    case 3:
      return {
        ...base,
        title: 'Your membership expires in 3 days',
        body: `Your ${account.plan} plan ends on ${weekday(account.expiry_date)}, ${date}. Renew at the NeoFit front desk to keep it active.`,
      };
    case 1:
      return { ...base, title: 'Your membership expires tomorrow', body: `Your plan ends tomorrow, ${date}. Renew at the NeoFit front desk to keep it active.` };
    default:
      return null;
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PushTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export interface PushOutcome {
  /** Account ids whose reminder was accepted by the Expo Push Service. */
  sent: string[];
  /** Account ids whose push token is no longer valid and must be cleared. */
  invalidTokens: string[];
}

/** Matches Expo's tickets (same order as the messages sent) to account ids. */
export function readTickets(accountIds: readonly string[], tickets: readonly PushTicket[]): PushOutcome {
  const outcome: PushOutcome = { sent: [], invalidTokens: [] };
  accountIds.forEach((id, i) => {
    const ticket = tickets[i];
    if (ticket?.status === 'ok') outcome.sent.push(id);
    else if (ticket?.details?.error === 'DeviceNotRegistered') outcome.invalidTokens.push(id);
  });
  return outcome;
}
