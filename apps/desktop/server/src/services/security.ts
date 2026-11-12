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
}

/** Signs and checks the JWT that the desktop sends with every request. */
export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttl: string,
  ) {}

  sign(claims: TokenClaims): string {
    return jwt.sign(claims, this.secret, { algorithm: 'HS256', expiresIn: this.ttl as jwt.SignOptions['expiresIn'] });
  }

  verify(token: string): TokenClaims {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      return { sub: String(payload.sub), email: String(payload.email), role: String(payload.role) };
    } catch {
      throw new UnauthorizedError('Invalid or expired token.');
    }
  }
}
