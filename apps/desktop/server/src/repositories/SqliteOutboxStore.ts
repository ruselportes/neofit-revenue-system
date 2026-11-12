import type { IOutboxStore, OutboxChange, OutboxEntity, OutboxItem, OutboxOperation } from '@neofit/core';
import { Repository } from './Repository';

interface OutboxRow {
  id: number;
  entity: string;
  record_id: string | null;
  action: OutboxOperation;
  attempts: number;
}

/**
 * The sync_outbox table. It keeps only what to publish (kind, record id, action): the
 * publisher reads the current record when it sends, so the cloud always gets the latest copy.
 */
export class SqliteOutboxStore extends Repository implements IOutboxStore {
  async add(change: OutboxChange): Promise<OutboxItem> {
    const result = this.db
      .prepare('INSERT INTO sync_outbox (entity, record_id, action) VALUES (?, ?, ?)')
      .run(toColumn(change.entity), change.entityId || null, change.operation);
    return { ...change, id: Number(result.lastInsertRowid), attempts: 0 };
  }

  async pending(): Promise<OutboxItem[]> {
    const rows = this.db.prepare('SELECT * FROM sync_outbox ORDER BY id').all() as OutboxRow[];
    return rows.map((r) => ({
      id: r.id,
      entity: fromColumn(r.entity),
      entityId: r.record_id ?? '',
      operation: r.action,
      payload: undefined,
      attempts: r.attempts,
    }));
  }

  async remove(id: number): Promise<void> {
    this.db.prepare('DELETE FROM sync_outbox WHERE id = ?').run(id);
  }

  async recordFailure(id: number, _message: string): Promise<void> {
    this.db.prepare('UPDATE sync_outbox SET attempts = attempts + 1 WHERE id = ?').run(id);
  }
}

// The SDD names the rates entity "rates"; the core calls it "rate".
const toColumn = (e: OutboxEntity): string => (e === 'rate' ? 'rates' : e);
const fromColumn = (c: string): OutboxEntity => (c === 'rates' ? 'rate' : (c as OutboxEntity));
