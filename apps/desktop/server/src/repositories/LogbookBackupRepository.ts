import { Repository } from './Repository';

export interface BackupEntry {
  id: string;
  date: string;
  name: string;
  amount: number;
  uploadId: string;
  createdAt: string;
}

/** Local copy of the entries the desktop adds or edits, so they can be recovered if the cloud data is lost. */
export class LogbookBackupRepository extends Repository {
  upsert(e: BackupEntry): void {
    this.db
      .prepare(
        `INSERT INTO logbook_entries_backup (id, date, name, amount, upload_id, created_at)
         VALUES (@id, @date, @name, @amount, @uploadId, @createdAt)
         ON CONFLICT(id) DO UPDATE SET date = excluded.date, name = excluded.name, amount = excluded.amount`,
      )
      .run(e);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM logbook_entries_backup WHERE id = ?').run(id);
  }

  removeUpload(uploadId: string): void {
    this.db.prepare('DELETE FROM logbook_entries_backup WHERE upload_id = ?').run(uploadId);
  }

  list(): BackupEntry[] {
    return (
      this.db.prepare('SELECT id, date, name, amount, upload_id AS uploadId, created_at AS createdAt FROM logbook_entries_backup ORDER BY date, created_at').all() as BackupEntry[]
    );
  }
}
