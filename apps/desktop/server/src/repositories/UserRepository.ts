import type { UserRecord } from '../models';
import { Repository } from './Repository';

interface UserRow {
  id: number;
  email: string;
  password: string;
  recovery_hash: string | null;
  role: string;
}

export class UserRepository extends Repository {
  findByEmail(email: string): UserRecord | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as UserRow | undefined;
    return row && this.toRecord(row);
  }

  findById(id: number): UserRecord | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row && this.toRecord(row);
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  insert(email: string, passwordHash: string, role: string, recoveryHash: string | null = null): void {
    this.db
      .prepare('INSERT INTO users (email, password, role, recovery_hash) VALUES (?, ?, ?, ?)')
      .run(email, passwordHash, role, recoveryHash);
  }

  setRecoveryHash(id: number, recoveryHash: string): void {
    this.db.prepare('UPDATE users SET recovery_hash = ? WHERE id = ?').run(recoveryHash, id);
  }

  /** Saves a new password and the next recovery key together (a used key is never valid again). */
  setPasswordAndRecovery(id: number, passwordHash: string, recoveryHash: string): void {
    this.db.prepare('UPDATE users SET password = ?, recovery_hash = ? WHERE id = ?').run(passwordHash, recoveryHash, id);
  }

  private toRecord(row: UserRow): UserRecord {
    return { id: row.id, email: row.email, passwordHash: row.password, recoveryHash: row.recovery_hash, role: row.role };
  }
}
