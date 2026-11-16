import { randomInt } from 'node:crypto';
import { ValidationError } from '@neofit/core';
import { ConflictError, UnauthorizedError } from '../errors';
import type { UserRepository } from '../repositories/UserRepository';
import { type IPasswordHasher, type TokenService } from './security';

export interface LoginResult {
  token: string;
  email: string;
  role: string;
  /** False for accounts made before recovery keys existed; the app then asks the administrator to make one. */
  hasRecoveryKey: boolean;
}

/** A new session plus the one-time recovery key that goes with it. The key is shown once and never stored in clear. */
export interface SessionWithKey extends LoginResult {
  recoveryKey: string;
}

// No 0/O/1/I/L, so a key that is read from paper is not mistaken.
const KEY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export class AuthService {
  /** Compared against when the email is unknown, so a wrong email and a wrong password take equally long. */
  private dummyHash: Promise<string> | null = null;
  /** Failed recovery attempts per email. A few wrong keys lock the reset for a while (kept in memory). */
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: TokenService,
    private readonly now: () => number = Date.now,
  ) {}

  async login(email: unknown, password: unknown): Promise<LoginResult> {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new ValidationError('Email and password are required.');
    }
    const user = this.users.findByEmail(email.trim());
    const hash = user?.passwordHash ?? (await this.dummy());
    const valid = await this.hasher.verify(password, hash);
    if (!user || !valid) throw new UnauthorizedError('Invalid email or password.');
    return this.session(user);
  }

  /** True until the administrator account has been created. */
  needsSetup(): boolean {
    return this.users.count() === 0;
  }

  /** First-run setup from the Login view. Works once: after that the account exists and this is refused. */
  async setup(email: unknown, password: unknown): Promise<SessionWithKey> {
    if (!this.needsSetup()) throw new ConflictError('The administrator account already exists.');
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ValidationError('Enter a valid email address.');
    }
    this.checkNewPassword(password);
    const recoveryKey = generateKey();
    this.users.insert(email.trim(), await this.hasher.hash(password as string), 'admin', await this.hasher.hash(normalizeKey(recoveryKey)));
    return { ...(await this.login(email, password)), recoveryKey };
  }

  /** Creates the administrator on the first run, only when the users table is empty. */
  async seedAdmin(email: string | undefined, password: string | undefined): Promise<boolean> {
    if (!email || !password || this.users.count() > 0) return false;
    this.users.insert(email.trim(), await this.hasher.hash(password), 'admin');
    return true;
  }

  /** Makes a new recovery key for the signed-in administrator. The old key stops working. Needs the current password. */
  async issueRecoveryKey(userId: unknown, password: unknown): Promise<{ recoveryKey: string }> {
    const user = this.users.findById(Number(userId));
    if (!user) throw new UnauthorizedError('Sign in required.');
    if (typeof password !== 'string' || !(await this.hasher.verify(password, user.passwordHash))) {
      throw new UnauthorizedError('The password is not correct.');
    }
    const recoveryKey = generateKey();
    this.users.setRecoveryHash(user.id, await this.hasher.hash(normalizeKey(recoveryKey)));
    return { recoveryKey };
  }

  /**
   * Forgot password: the email plus the recovery key set a new password. The used key is replaced by a new one,
   * returned here once. Five wrong keys for the same email lock this for 15 minutes.
   */
  async resetPassword(email: unknown, recoveryKey: unknown, newPassword: unknown): Promise<SessionWithKey> {
    if (typeof email !== 'string' || typeof recoveryKey !== 'string' || !email.trim() || !recoveryKey.trim()) {
      throw new ValidationError('Email and recovery key are required.');
    }
    this.checkNewPassword(newPassword);
    const id = email.trim().toLowerCase();
    const state = this.failures.get(id);
    if (state && state.lockedUntil > this.now()) {
      throw new UnauthorizedError('Too many wrong recovery keys. Try again in 15 minutes.');
    }

    const user = this.users.findByEmail(email.trim());
    const hash = user?.recoveryHash ?? (await this.dummy());
    const valid = await this.hasher.verify(normalizeKey(recoveryKey), hash);
    if (!user || !user.recoveryHash || !valid) {
      // A lock that has run out starts the count again; before that the count keeps growing.
      const lockEnded = state !== undefined && state.lockedUntil !== 0 && state.lockedUntil <= this.now();
      const count = (lockEnded ? 0 : (state?.count ?? 0)) + 1;
      this.failures.set(id, { count, lockedUntil: count >= MAX_ATTEMPTS ? this.now() + LOCK_MS : 0 });
      throw new UnauthorizedError('The email or the recovery key is not correct.');
    }

    this.failures.delete(id);
    const next = generateKey();
    this.users.setPasswordAndRecovery(user.id, await this.hasher.hash(newPassword as string), await this.hasher.hash(normalizeKey(next)));
    return { ...(await this.login(email, newPassword)), recoveryKey: next };
  }

  private session(user: { id: number; email: string; role: string; recoveryHash: string | null }): LoginResult {
    return {
      token: this.tokens.sign({ sub: String(user.id), email: user.email, role: user.role }),
      email: user.email,
      role: user.role,
      hasRecoveryKey: user.recoveryHash !== null,
    };
  }

  private checkNewPassword(password: unknown): void {
    if (typeof password !== 'string' || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters.');
    }
  }

  private dummy(): Promise<string> {
    return (this.dummyHash ??= this.hasher.hash('not-a-real-password'));
  }
}

/** A key like K7QM4-XT29R-WDHC3-PVN8B (20 characters, about 99 bits). */
export function generateKey(): string {
  const chars = Array.from({ length: 20 }, () => KEY_ALPHABET[randomInt(KEY_ALPHABET.length)]!);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-');
}

/** Upper case, no dashes or spaces, so the key can be typed in any way. */
export function normalizeKey(key: string): string {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
