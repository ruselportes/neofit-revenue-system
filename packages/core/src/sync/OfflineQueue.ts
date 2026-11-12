import { LogbookUpload, type LogbookUploadJSON } from '../domain';
import { type IClock, type IKeyValueStore, SystemClock } from '../ocr/ports';
import { Mutex, TypedEmitter } from './support';

/** Sends one page to the cloud with an upsert, so sending it twice never duplicates rows. Throws on failure. */
export interface IUploadGateway {
  upsertUpload(upload: LogbookUpload): Promise<void>;
}

export interface QueuedUpload {
  readonly upload: LogbookUpload;
  readonly queuedAt: string;
}

export interface SyncSummary {
  readonly synced: number;
  readonly failed: number;
}

export interface OfflineQueueEvents {
  queued: QueuedUpload;
  synced: QueuedUpload;
  failed: { item: QueuedUpload; error: Error };
}

interface StoredItem {
  upload: LogbookUploadJSON;
  queuedAt: string;
}

/**
 * Pages that could not be uploaded wait here. A page leaves the queue only after
 * its upload succeeds, so a page is never lost.
 */
export class OfflineQueue {
  static readonly STORAGE_KEY = 'neofit_offline_queue';

  readonly events = new TypedEmitter<OfflineQueueEvents>();

  private readonly lock = new Mutex();
  private running: Promise<SyncSummary> | null = null;

  constructor(
    private readonly store: IKeyValueStore,
    private readonly gateway: IUploadGateway,
    private readonly clock: IClock = new SystemClock(),
  ) {}

  async items(): Promise<QueuedUpload[]> {
    return this.read();
  }

  async pendingCount(): Promise<number> {
    return (await this.read()).length;
  }

  /** Queues a page. Queuing the same page again replaces the earlier copy. */
  async enqueue(upload: LogbookUpload): Promise<QueuedUpload> {
    const item: QueuedUpload = { upload, queuedAt: this.clock.now().toISOString() };
    await this.lock.run(async () => {
      const items = (await this.read()).filter((i) => i.upload.id !== upload.id);
      await this.write([...items, item]);
    });
    this.events.emit('queued', item);
    return item;
  }

  /** Uploads every queued page. A call made while a sync is running joins that sync. */
  syncQueue(): Promise<SyncSummary> {
    this.running ??= this.runSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runSync(): Promise<SyncSummary> {
    let synced = 0;
    let failed = 0;
    for (const item of await this.read()) {
      try {
        await this.gateway.upsertUpload(item.upload);
      } catch (err) {
        failed++;
        this.events.emit('failed', { item, error: err instanceof Error ? err : new Error(String(err)) });
        continue;
      }
      await this.remove(item.upload.id);
      synced++;
      this.events.emit('synced', item);
    }
    return { synced, failed };
  }

  private remove(id: string): Promise<void> {
    return this.lock.run(async () => {
      await this.write((await this.read()).filter((i) => i.upload.id !== id));
    });
  }

  private async read(): Promise<QueuedUpload[]> {
    try {
      const raw = await this.store.getItem(OfflineQueue.STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as StoredItem[]) : [];
      return stored.map((s) => ({ upload: LogbookUpload.fromJSON(s.upload), queuedAt: s.queuedAt }));
    } catch {
      return [];
    }
  }

  private async write(items: readonly QueuedUpload[]): Promise<void> {
    const stored: StoredItem[] = items.map((i) => ({ upload: i.upload.toJSON(), queuedAt: i.queuedAt }));
    await this.store.setItem(OfflineQueue.STORAGE_KEY, JSON.stringify(stored));
  }
}
