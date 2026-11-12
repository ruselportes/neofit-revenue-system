// Edge Function: send-reminders. Started every morning by pg_cron (migration 0002).
// It sends a push notification to members whose plan ends in 7, 3 or 1 day.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildReminder, chunk, dueExpiryDates, manilaToday, readTickets, type DueAccount, type PushTicket } from '../_shared/reminders.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Constant-time comparison, so the service key cannot be guessed from response timing. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!serviceKey || !sameSecret(bearer, serviceKey)) return json({ error: 'Not allowed.' }, 401);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });
  const today = manilaToday(new Date());

  const { data, error } = await db
    .from('member_accounts')
    .select('id, plan, expiry_date, push_token, last_reminder_on')
    .not('push_token', 'is', null)
    .in('expiry_date', dueExpiryDates(today));
  if (error) return json({ error: error.message }, 500);

  const due = ((data ?? []) as DueAccount[]).flatMap((account) => {
    const message = buildReminder(account, today);
    return message ? [{ id: account.id, message }] : [];
  });

  let sent = 0;
  let cleared = 0;
  for (const batch of chunk(due, 100)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map((b) => b.message)),
    });
    if (!res.ok) continue; // not marked as sent, so the next run tries again
    const tickets = ((await res.json()) as { data?: PushTicket[] }).data ?? [];
    const outcome = readTickets(batch.map((b) => b.id), tickets);

    if (outcome.sent.length > 0) {
      await db.from('member_accounts').update({ last_reminder_on: today }).in('id', outcome.sent);
      sent += outcome.sent.length;
    }
    if (outcome.invalidTokens.length > 0) {
      await db.from('member_accounts').update({ push_token: null }).in('id', outcome.invalidTokens);
      cleared += outcome.invalidTokens.length;
    }
  }

  return json({ today, due: due.length, sent, clearedTokens: cleared });
});
