import type Database from 'better-sqlite3';
import type { AppDatabase } from '../database/AppDatabase';

/** Base of the SQLite repositories. Only repositories talk to the database. */
export abstract class Repository {
  protected readonly db: Database.Database;

  constructor(protected readonly database: AppDatabase) {
    this.db = database.connection;
  }
}
