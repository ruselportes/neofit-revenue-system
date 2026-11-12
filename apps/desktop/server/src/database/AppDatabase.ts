import Database from 'better-sqlite3';

/** The single SQLite file of the gym (SDD Section 3.1.2). Creates the tables on first use. */
export class AppDatabase {
  readonly connection: Database.Database;

  constructor(path: string) {
    this.connection = new Database(path);
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = ON');
    this.migrate();
  }

  /** Runs the work in one transaction: all of it is saved, or none of it. */
  transaction<T>(work: () => T): T {
    return this.connection.transaction(work)();
  }

  close(): void {
    this.connection.close();
  }

  private migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        email TEXT,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        joined_date TEXT,
        expiry_date TEXT,
        address TEXT NOT NULL DEFAULT '',
        photo TEXT,
        cloud_id TEXT,
        invited_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS member_payments (
        id TEXT PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        receipt_no TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        plan TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT,
        paid_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON member_payments(paid_at);

      CREATE TABLE IF NOT EXISTS rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        monthly REAL NOT NULL DEFAULT 0,
        semi REAL NOT NULL DEFAULT 0,
        daily REAL NOT NULL DEFAULT 0,
        UNIQUE (category, type)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        gym_name TEXT NOT NULL DEFAULT 'NeoFit Fitness Gym',
        contact TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT ''
      );
      INSERT OR IGNORE INTO settings (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS logbook_entries_backup (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        upload_id TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        record_id TEXT,
        action TEXT NOT NULL,
        queued_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        attempts INTEGER NOT NULL DEFAULT 0
      );
    `);
  }
}
