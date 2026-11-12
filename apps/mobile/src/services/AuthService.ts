import type { SupabaseClient } from '@supabase/supabase-js';
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

type Listener = (state: AuthState) => void;

/**
 * Who is signed in, and as what (SDD Section 4.1). Staff and owners have a profile; members have
 * only a member account. A disabled account is signed out at once.
 */
export class AuthService {
  private state: AuthState = { kind: 'loading' };
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly profiles: ProfileRepository,
    private readonly members: MemberRepository,
    private readonly redirectUrl?: string,
  ) {}

  current(): AuthState {
    return this.state;
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
      if (event === 'SIGNED_OUT') this.set({ kind: 'signedOut' });
    });

    const { data } = await this.client.auth.getSession();
    if (!data.session) return this.set({ kind: 'signedOut' });
    try {
      await this.resolve(data.session.user.id);
    } catch {
      // Cannot be reached or no longer allowed: stay out until the user signs in again.
      this.set({ kind: 'signedOut' });
    }
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
    await this.client.auth.signOut();
    this.set({ kind: 'signedOut' });
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
      return this.set({ kind: 'staff', profile });
    }

    const account = await this.members.accountForUser(userId);
    if (account) return this.set({ kind: 'member', account });

    await this.signOut();
    throw new AuthError('This account does not have access to the app.');
  }

  private set(state: AuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
