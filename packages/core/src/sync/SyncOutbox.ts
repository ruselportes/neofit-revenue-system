import { TypedEmitter } from './support';

export type OutboxEntity = 'member' | 'payment' | 'rate';
export type OutboxOperation = 'upsert' | 'delete';

export interface OutboxChange {
  readonly entity: OutboxEntity;
  readonly operation: OutboxOperation;
  readonly entityId: string;
  readonly payload: unknown;
}

export interface OutboxItem extends OutboxChange {
  readonly id: number;
  readonly attempts: number;
  readonly lastError?: string;
}

/** Storage of the outbox. The desktop backs it with the sync_outbox SQLite table. */
export interface IOutboxStore {
  add(change: OutboxChange): Promise<OutboxItem>;
  /** Pending items in the order they were queued. */
  pending(): Promise<OutboxItem[]>;
  remove(id: number): Promise<void>;
  recordFailure(id: number, message: string): Promise<void>;
}

/** Sends one change to the cloud. Must be idempotent (upsert or delete). Throws on failure. */
export interface ICloudPublisher {
  publish(item: OutboxItem): Promise<void>;
}

export interface PublishSummary {
  readonly published: number;
  readonly failed: number;
  readonly remaining: number;
}

export interface OutboxEvents {
  published: OutboxItem;
  failed: { item: OutboxItem; error: Error };
}

/**
 * Changes wait here until the cloud accepts them. Items are sent in the order they were
 * queued, and an item is removed only after it was accepted. When one fails, publishing
 * stops so later items never arrive before it (a payment before its member); the failure
 * is counted and the item is retried on the next run.
 */
export class SyncOutbox {
  readonly events = new TypedEmitter<OutboxEvents>();
  private running: Promise<PublishSummary> | null = null;

  constructor(
    private readonly store: IOutboxStore,
    private readonly publisher: ICloudPublisher,
  ) {}

  queueChange(change: OutboxChange): Promise<OutboxItem> {
    return this.store.add(change);
  }

  /** Publishes the pending items. A call made while a run is in progress joins that run. */
  publishPending(): Promise<PublishSummary> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<PublishSummary> {
    const items = await this.store.pending();
    let published = 0;
    for (const item of items) {
      try {
        await this.publisher.publish(item);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        await this.store.recordFailure(item.id, error.message);
        this.events.emit('failed', { item, error });
        return { published, failed: 1, remaining: items.length - published };
      }
      await this.store.remove(item.id);
      published++;
      this.events.emit('published', item);
    }
    return { published, failed: 0, remaining: 0 };
  }
}

/** Simple in-memory store for tests and previews. */
export class InMemoryOutboxStore implements IOutboxStore {
  private items: OutboxItem[] = [];
  private nextId = 1;

  async add(change: OutboxChange): Promise<OutboxItem> {
    const item: OutboxItem = { ...change, id: this.nextId++, attempts: 0 };
    this.items.push(item);
    return item;
  }

  async pending(): Promise<OutboxItem[]> {
    return [...this.items];
  }

  async remove(id: number): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
  }

  async recordFailure(id: number, message: string): Promise<void> {
    this.items = this.items.map((i) => (i.id === id ? { ...i, attempts: i.attempts + 1, lastError: message } : i));
  }
}
