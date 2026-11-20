// Edge Function: member-access. Called by the desktop with the owner's session.
//   invite: creates the member's sign-in account already confirmed and emails a six-digit sign-in code
//           (or sends a new code if the account exists); records user_id and invited_at.
//   remove: deletes the member's cloud copy and sign-in account.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isAlreadyRegistered, mayManageMembers, parseAccessRequest } from '../_shared/access.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in required.' }, 401);

  // Who is calling? Ask Auth, then read the profile with the service role.
  const caller = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid or expired session.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('role, is_active').eq('id', userData.user.id).maybeSingle();
  if (!mayManageMembers(profile)) return json({ error: 'Only the owner can manage member access.' }, 403);

  const parsed = parseAccessRequest(await req.json().catch(() => null));
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { action, accountId } = parsed.value;

  const { data: account, error: accountError } = await admin
    .from('member_accounts')
    .select('id, email, user_id')
    .eq('id', accountId)
    .maybeSingle();
  if (accountError) return json({ error: accountError.message }, 500);
  if (!account) return json({ error: 'Member account not found. Publish the member first.' }, 404);

  if (action === 'remove') {
    if (account.user_id) {
      const { error } = await admin.auth.admin.deleteUser(account.user_id);
      if (error && !/not found/i.test(error.message)) return json({ error: error.message }, 500);
    }
    const { error } = await admin.from('member_accounts').delete().eq('id', accountId);
    if (error) return json({ error: error.message }, 500);
    return json({ status: 'removed' });
  }

  // invite: make the sign-in account already confirmed (so there is no link to click), then email the sign-in code.
  // MEMBER_APP_URL only matters while the email template still holds a link; with a code-only template it is not used.
  const redirectTo = Deno.env.get('MEMBER_APP_URL') ?? undefined;
  const created = await admin.auth.admin.createUser({
    email: account.email,
    email_confirm: true,
    user_metadata: { kind: 'member' },
  });

  let userId = created.data?.user?.id ?? account.user_id;
  let status: 'invited' | 'resent' = 'invited';

  if (created.error) {
    if (!isAlreadyRegistered(created.error)) return json({ error: created.error.message }, 500);
    // The account exists: never a second one. An account that an older invite left unconfirmed is confirmed now, so a
    // code can sign it in.
    if (account.user_id) await admin.auth.admin.updateUserById(account.user_id, { email_confirm: true });
    status = 'resent';
  }

  const { error: codeError } = await caller.auth.signInWithOtp({
    email: account.email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (codeError) return json({ error: codeError.message }, 500);

  const invitedAt = new Date().toISOString();
  // Keep the stored user_id when the account already existed and its id is not known here.
  const { error: updateError } = await admin
    .from('member_accounts')
    .update(userId ? { user_id: userId, invited_at: invitedAt } : { invited_at: invitedAt })
    .eq('id', accountId);
  if (updateError) return json({ error: updateError.message }, 500);

  return json({ status, userId, invitedAt });
});
