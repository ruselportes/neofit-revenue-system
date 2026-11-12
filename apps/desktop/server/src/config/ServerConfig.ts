import { ValidationError } from '@neofit/core';

/** The owner account the desktop uses to reach Supabase. Optional: without it the app works offline. */
export interface CloudSettings {
  url: string;
  anonKey: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface ServerConfigValues {
  cloud?: CloudSettings;
  jwtSecret: string;
  dbPath: string;
  port: number;
  tokenTtl: string;
  corsOrigins: string[];
  /** Used only to create the first account when the users table is empty. */
  adminEmail?: string;
  adminPassword?: string;
}

/**
 * All settings come from the environment. There are no built-in secrets or default
 * passwords: a missing or weak JWT secret stops the server from starting.
 */
export class ServerConfig implements ServerConfigValues {
  readonly host = '127.0.0.1';

  private constructor(private readonly values: ServerConfigValues) {}

  static from(values: ServerConfigValues): ServerConfig {
    if (values.jwtSecret.length < 32) throw new ValidationError('JWT_SECRET must be at least 32 characters.');
    if (!values.dbPath) throw new ValidationError('DB_PATH is required.');
    if (!Number.isInteger(values.port) || values.port < 0 || values.port > 65535) {
      throw new ValidationError('PORT must be a valid port number.');
    }
    if (!!values.adminEmail !== !!values.adminPassword) {
      throw new ValidationError('ADMIN_EMAIL and ADMIN_PASSWORD must be set together.');
    }
    if (values.adminPassword !== undefined && values.adminPassword.length < 8) {
      throw new ValidationError('ADMIN_PASSWORD must be at least 8 characters.');
    }
    if (values.cloud) {
      const { url, anonKey, ownerEmail, ownerPassword } = values.cloud;
      if (!anonKey || !ownerEmail || !ownerPassword) {
        throw new ValidationError('SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_OWNER_EMAIL and SUPABASE_OWNER_PASSWORD must be set together.');
      }
      // The owner's password is sent to this address, so it must be encrypted (or this very computer).
      if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) {
        throw new ValidationError('SUPABASE_URL must start with https://.');
      }
    }
    return new ServerConfig(values);
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
    return ServerConfig.from({
      jwtSecret: env.JWT_SECRET ?? '',
      dbPath: env.DB_PATH ?? '',
      port: env.PORT ? Number(env.PORT) : 3001,
      tokenTtl: env.TOKEN_TTL ?? '24h',
      corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
      adminEmail: env.ADMIN_EMAIL || undefined,
      adminPassword: env.ADMIN_PASSWORD || undefined,
      cloud: env.SUPABASE_URL || env.SUPABASE_ANON_KEY || env.SUPABASE_OWNER_EMAIL || env.SUPABASE_OWNER_PASSWORD
        ? {
            url: (env.SUPABASE_URL ?? '').replace(/\/+$/, ''),
            anonKey: env.SUPABASE_ANON_KEY ?? '',
            ownerEmail: env.SUPABASE_OWNER_EMAIL ?? '',
            ownerPassword: env.SUPABASE_OWNER_PASSWORD ?? '',
          }
        : undefined,
    });
  }

  get cloud() {
    return this.values.cloud;
  }

  get jwtSecret() {
    return this.values.jwtSecret;
  }
  get dbPath() {
    return this.values.dbPath;
  }
  get port() {
    return this.values.port;
  }
  get tokenTtl() {
    return this.values.tokenTtl;
  }
  get corsOrigins() {
    return this.values.corsOrigins;
  }
  get adminEmail() {
    return this.values.adminEmail;
  }
  get adminPassword() {
    return this.values.adminPassword;
  }
}
