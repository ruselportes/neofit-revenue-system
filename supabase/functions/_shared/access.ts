// Pure rules of the member-access function (SDD Section 4.11). No Deno APIs, so it can be tested.

export type AccessAction = { action: 'invite'; accountId: string } | { action: 'remove'; accountId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks the request body; returns the action or a message for the caller. */
export function parseAccessRequest(body: unknown): { ok: true; value: AccessAction } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object.' };
  const { action, accountId } = body as Record<string, unknown>;
  if (action !== 'invite' && action !== 'remove') return { ok: false, error: 'action must be "invite" or "remove".' };
  if (typeof accountId !== 'string' || !UUID.test(accountId)) return { ok: false, error: 'accountId must be a UUID.' };
  return { ok: true, value: { action, accountId } };
}

/** Only an active owner may invite or remove members. */
export function mayManageMembers(profile: { role: string; is_active: boolean } | null): boolean {
  return profile !== null && profile.role === 'owner' && profile.is_active === true;
}

/** Supabase says "already registered" in a few ways; all of them mean the member has an account. */
export function isAlreadyRegistered(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'email_exists' ||
    error.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(error.message ?? '')
  );
}
