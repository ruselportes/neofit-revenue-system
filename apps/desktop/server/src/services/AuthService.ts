import { ValidationError } from '@neofit/core';
import { ConflictError, UnauthorizedError } from '../errors';
import type { UserRepository } from '../repositories/UserRepository';
import { type IPasswordHasher, type TokenService } from './security';

export class AuthService {
  /** Compared against when the email is unknown, so a wrong email and a wrong password take equally long. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async login(email: unknown, password: unknown): Promise<{ token: string; email: string; role: string }> {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new ValidationError('Email and password are required.');
    }
    const user = this.users.findByEmail(email.trim());
    const hash = user?.passwordHash ?? (await (this.dummyHash ??= this.hasher.hash('not-a-real-password')));
    const valid = await this.hasher.verify(password, hash);
    if (!user || !valid) throw new UnauthorizedError('Invalid email or password.');

    return {
      token: this.tokens.sign({ sub: String(user.id), email: user.email, role: user.role }),
      email: user.email,
      role: user.role,
    };
  }

  /** True until the administrator account has been created. */
  needsSetup(): boolean {
    return this.users.count() === 0;
  }

  /** First-run setup from the Login view. Works once: after that the account exists and this is refused. */
  async setup(email: unknown, password: unknown): Promise<{ token: string; email: string; role: string }> {
    if (!this.needsSetup()) throw new ConflictError('The administrator account already exists.');
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ValidationError('Enter a valid email address.');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters.');
    }
    this.users.insert(email.trim(), await this.hasher.hash(password), 'admin');
    return this.login(email, password);
  }

  /** Creates the administrator on the first run, only when the users table is empty. */
  async seedAdmin(email: string | undefined, password: string | undefined): Promise<boolean> {
    if (!email || !password || this.users.count() > 0) return false;
    this.users.insert(email.trim(), await this.hasher.hash(password), 'admin');
    return true;
  }
}
