import type { UserRecord } from '../models';
import { Repository } from './Repository';

interface UserRow {
  id: number;
  email: string;
  password: string;
  role: string;
}

export class UserRepository extends Repository {
  findByEmail(email: string): UserRecord | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as UserRow | undefined;
    return row && { id: row.id, email: row.email, passwordHash: row.password, role: row.role };
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  insert(email: string, passwordHash: string, role: string): void {
    this.db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)').run(email, passwordHash, role);
  }
}
