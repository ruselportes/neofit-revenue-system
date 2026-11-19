import { isAuthRetryableFetchError, type AuthError as SupabaseAuthError, type SupabaseClient } from '@supabase/supabase-js';
import type { MemberRepository, ProfileRepository } from '../cloud/repositories';
import type { MemberAccount, Profile } from '../cloud/types';
import { parseAuthUrl } from './authLinks';

export type AuthState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'staff'; profile: Profile }
  | { kind: 'member'; account: MemberAccount };

/** A sign-in problem the user can understand; the message is shown as is. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Where the last known identity is kept between app launches (Secure Store on the phone). */
export interface IdentityCache {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const IDENTITY_KEY = 'neofit_last_identity';

type Identity = { userId: string; state: Extract<AuthState, { kind: 'staff' | 'member' }> };
type Listener = (state: AuthState) => void;

/**
 * Who is signed in, and as what (SDD Section 4.1). Staff and owners have a profile; members have
 * only a member account. A disabled account is signed out at once.
 *
 * The sign-in itself is kept by the Supabase client in Secure Store, so it survives the app being closed. What this
 * class adds is that a bad moment at launch (no signal yet, a slow network) does not look like a sign-out: the last
 * known identity opens the app, and the person is signed out only on a definite answer (disabled account, no access,
 * or the saved login refused).
 */
export class AuthService {
  private state: AuthState = { kind: 'loading' };
  private offline = false;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly profiles: ProfileRepository,
    private readonly members: MemberRepository,
    private readonly redirectUrl?: string,
    private readonly cache?: IdentityCache,
  ) {}

  current(): AuthState {
    return this.state;
  }

  /** True while the app is open on the last known identity because the server could not be reached. */
  isOffline(): boolean {
    return this.offline;
  }

  /** Calls the listener now and after every change. Returns a function that stops it. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Restores the saved session when the app opens. */
  async start(): Promise<void> {
    // Only record a sign-out here: calling the database from inside this callback can deadlock the client.
    this.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') void this.forget();
    });
    await this.restore();
  }

  /**
   * Checks the saved sign-in again. Called when the app comes back to the foreground and when the connection returns,
   * so a person who was let in on the last known identity is confirmed (or refused) as soon as the server answers.
   */
  async revalidate(): Promise<void> {
    if (this.state.kind === 'staff' || this.state.kind === 'member') await this.restore();
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw new AuthError(error?.message === 'Invalid login credentials' ? 'Wrong email or password.' : (error?.message ?? 'Could not sign in.'));
    await this.resolve(data.user.id, 'staff');
  }

  /**
   * Emails a one-time sign-in link. The answer is the same whether or not the address was invited,
   * so nobody can use this screen to find out who is a member.
   */
  async requestMemberLink(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: this.redirectUrl },
    });
    if (error && /network|fetch|timeout/i.test(error.message)) throw new AuthError('Cannot reach the server. Check your connection and try again.');
  }

  /** Called with the address of an opened sign-in link. Returns false if it is not a sign-in link. */
  async handleUrl(url: string): Promise<boolean> {
    const tokens = parseAuthUrl(url);
    if (!tokens) return false;
    const { data, error } = await this.client.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
    if (error || !data.user) throw new AuthError('This sign-in link has expired. Ask for a new one.');
    await this.resolve(data.user.id, 'member');
    return true;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut().catch(() => undefined);
    await this.forget();
  }

  async changePassword(newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new AuthError('The new password must be at least 8 characters.');
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError(error.message);
  }

  /** Reloads the signed-in person's profile or membership, for example after editing the name. */
  async refresh(): Promise<void> {
    const { data } = await this.client.auth.getUser();
    if (data.user) await this.resolve(data.user.id);
  }

  // ---- inside ----

  /** Looks at the saved session and decides: signed in, signed out, or "cannot tell yet" (then the last identity is used). */
  private async restore(): Promise<void> {
    const { data, error } = await this.client.auth.getSession();

    if (!data.session) {
      // No usable session. If the server just could not be reached to renew it, the login is still saved: stay in.
      if (error && this.couldBeTemporary(error)) return this.useLastIdentity();
      return this.forget();
    }

    try {
      await this.resolve(data.session.user.id);
    } catch (err) {
      // Only our own refusals (disabled account, no access) end the sign-in. Anything else, such as no signal or a
      // slow server, says nothing about the account, so the last known identity is used and checked again later.
      if (err instanceof AuthError) return this.forget();
      return this.useLastIdentity();
    }
  }

  private async resolve(userId: string, expected?: 'staff' | 'member'): Promise<void> {
    const profile = await this.profiles.get(userId);
    if (profile) {
      if (!profile.isActive) {
        await this.signOut();
        throw new AuthError('This account has been disabled. Please contact the owner.');
      }
      if (expected === 'member') {
        await this.signOut();
        throw new AuthError('Staff sign in with their email and password.');
      }
      return this.confirm(userId, { kind: 'staff', profile });
    }

    const account = await this.members.accountForUser(userId);
    if (account) return this.confirm(userId, { kind: 'member', account });

    await this.signOut();
    throw new AuthError('This account does not have access to the app.');
  }

  /** The server answered and the person is who we thought: remember them for the next launch. */
  private async confirm(userId: string, state: Identity['state']): Promise<void> {
    this.offline = false;
    this.set(state);
    await this.cache?.setItem(IDENTITY_KEY, JSON.stringify({ userId, state } satisfies Identity)).catch(() => undefined);
  }

  /** The server could not be reached: open the app on who was last signed in, if anyone. */
  private async useLastIdentity(): Promise<void> {
    const identity = await this.readIdentity();
    if (!identity) return this.set({ kind: 'signedOut' });
    this.offline = true;
    this.set(identity.state);
  }

  private async readIdentity(): Promise<Identity | null> {
    try {
      const raw = await this.cache?.getItem(IDENTITY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Identity;
      return parsed.userId && (parsed.state?.kind === 'staff' || parsed.state?.kind === 'member') ? parsed : null;
    } catch {
      return null;
    }
  }

  private async forget(): Promise<void> {
    this.offline = false;
    await this.cache?.removeItem(IDENTITY_KEY).catch(() => undefined);
    this.set({ kind: 'signedOut' });
  }

  /** A failure that says nothing about the account: no signal, a timeout, a server hiccup. */
  private couldBeTemporary(err: unknown): boolean {
    if (isAuthRetryableFetchError(err)) return true;
    const status = (err as Partial<SupabaseAuthError> | null)?.status;
    const message = err instanceof Error ? err.message : '';
    return (typeof status === 'number' && status >= 500) || /network|fetch|timeout|timed out|failed to connect/i.test(message);
  }

  private set(state: AuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
