import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors';

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/** bcrypt hashes. The password itself is never stored. */
export class BcryptHasher implements IPasswordHasher {
  constructor(private readonly cost = 10) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  verify(password: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(password, hashed);
  }
}

export interface TokenClaims {
  sub: string;
  email: string;
  role: string;
  /** The user's session version when the token was made. A later sign-out or password reset makes it stale. */
  ver: number;
  /** True when the administrator chose "Keep me signed in": the token lasts longer and is renewed on each launch. */
  rem: boolean;
}

/** How long a "Keep me signed in" login lasts. Each launch renews it, so an admin who opens the app often stays in. */
export const REMEMBER_TTL = '30d';

/** Signs and checks the JWT that the desktop sends with every request. */
export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttl: string,
  ) {}

  /** A remembered login gets the long lifetime; any other gets the normal one (24 hours by default). */
  sign(claims: TokenClaims): string {
    const expiresIn = claims.rem ? REMEMBER_TTL : this.ttl;
    return jwt.sign(claims, this.secret, { algorithm: 'HS256', expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
  }

  verify(token: string): TokenClaims {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      return {
        sub: String(payload.sub),
        email: String(payload.email),
        role: String(payload.role),
        ver: Number(payload.ver ?? 0),
        rem: payload.rem === true,
      };
    } catch {
      throw new UnauthorizedError('Invalid or expired token.');
    }
  }
}
