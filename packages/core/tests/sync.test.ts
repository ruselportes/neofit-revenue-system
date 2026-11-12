import { describe, expect, it } from 'vitest';
import {
  type ICloudPublisher,
  type IConnectivity,
  InMemoryOutboxStore,
  type IKeyValueStore,
  type IUploadGateway,
  LogbookEntry,
  LogbookSaver,
  LogbookUpload,
  MemberSync,
  OfflineQueue,
  type OutboxItem,
  SyncOutbox,
} from '../src';

class MemoryStore implements IKeyValueStore {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

class FakeGateway implements IUploadGateway {
  received: string[] = [];
  failing = false;
  async upsertUpload(upload: LogbookUpload) {
    if (this.failing) throw new Error('offline');
    this.received.push(upload.id);
  }
}

const upload = (id: string) =>
  new LogbookUpload(id, '2026-11-04', 'staff-1', [new LogbookEntry('Ian', 450), new LogbookEntry('Rose', 90)]);

describe('LogbookUpload', () => {
  it('computes totals and survives a JSON round trip', () => {
    const u = upload('u1');
    expect([u.totalEntries, u.totalAmount.pesos]).toEqual([2, 540]);
    const copy = LogbookUpload.fromJSON(JSON.parse(JSON.stringify(u)));
    expect(copy.id).toBe('u1');
    expect(copy.totalAmount.pesos).toBe(540);
  });
});

describe('OfflineQueue', () => {
  it('keeps a page until its upload succeeds', async () => {
    const gateway = new FakeGateway();
    const queue = new OfflineQueue(new MemoryStore(), gateway);
    await queue.enqueue(upload('u1'));
    await queue.enqueue(upload('u2'));

    gateway.failing = true;
    expect(await queue.syncQueue()).toEqual({ synced: 0, failed: 2 });
    expect(await queue.pendingCount()).toBe(2);

    gateway.failing = false;
    expect(await queue.syncQueue()).toEqual({ synced: 2, failed: 0 });
    expect(await queue.pendingCount()).toBe(0);
    expect(gateway.received).toEqual(['u1', 'u2']);
  });

  it('replaces a page queued twice instead of duplicating it', async () => {
    const queue = new OfflineQueue(new MemoryStore(), new FakeGateway());
    await queue.enqueue(upload('u1'));
    await queue.enqueue(upload('u1'));
    expect(await queue.pendingCount()).toBe(1);
  });

  it('shares one run between overlapping syncs', async () => {
    const gateway = new FakeGateway();
    const queue = new OfflineQueue(new MemoryStore(), gateway);
    await queue.enqueue(upload('u1'));
    const [a, b] = await Promise.all([queue.syncQueue(), queue.syncQueue()]);
    expect(a).toBe(b);
    expect(gateway.received).toEqual(['u1']);
  });

  it('emits queued, synced and failed events', async () => {
    const gateway = new FakeGateway();
    const queue = new OfflineQueue(new MemoryStore(), gateway);
    const log: string[] = [];
    queue.events.on('queued', (i) => log.push(`queued:${i.upload.id}`));
    queue.events.on('synced', (i) => log.push(`synced:${i.upload.id}`));
    queue.events.on('failed', ({ item }) => log.push(`failed:${item.upload.id}`));
    await queue.enqueue(upload('u1'));
    gateway.failing = true;
    await queue.syncQueue();
    gateway.failing = false;
    await queue.syncQueue();
    expect(log).toEqual(['queued:u1', 'failed:u1', 'synced:u1']);
  });
});

describe('LogbookSaver', () => {
  const online = (value: boolean): IConnectivity => ({ isOnline: async () => value });

  it('saves straight to the cloud when online', async () => {
    const gateway = new FakeGateway();
    const queue = new OfflineQueue(new MemoryStore(), gateway);
    expect(await new LogbookSaver(gateway, queue, online(true)).save(upload('u1'))).toBe('synced');
    expect(await queue.pendingCount()).toBe(0);
  });
  it('queues the page when offline', async () => {
    const gateway = new FakeGateway();
    const queue = new OfflineQueue(new MemoryStore(), gateway);
    expect(await new LogbookSaver(gateway, queue, online(false)).save(upload('u1'))).toBe('queued');
    expect(gateway.received).toEqual([]);
    expect(await queue.pendingCount()).toBe(1);
  });
  it('queues the page when the online save fails', async () => {
    const gateway = new FakeGateway();
    gateway.failing = true;
    const queue = new OfflineQueue(new MemoryStore(), gateway);
    expect(await new LogbookSaver(gateway, queue, online(true)).save(upload('u1'))).toBe('queued');
    expect(await queue.pendingCount()).toBe(1);
  });
});

class FakePublisher implements ICloudPublisher {
  sent: string[] = [];
  failOn: string | null = null;
  async publish(item: OutboxItem) {
    if (item.entityId === this.failOn) throw new Error('cloud rejected');
    this.sent.push(item.entityId);
  }
}

describe('SyncOutbox', () => {
  const change = (entityId: string) => ({ entity: 'member' as const, operation: 'upsert' as const, entityId, payload: {} });

  it('publishes in order and empties the outbox', async () => {
    const store = new InMemoryOutboxStore();
    const publisher = new FakePublisher();
    const outbox = new SyncOutbox(store, publisher);
    await outbox.queueChange(change('m1'));
    await outbox.queueChange(change('m2'));
    expect(await outbox.publishPending()).toEqual({ published: 2, failed: 0, remaining: 0 });
    expect(publisher.sent).toEqual(['m1', 'm2']);
    expect(await store.pending()).toEqual([]);
  });

  it('stops at the first failure, counts the attempt, and retries later', async () => {
    const store = new InMemoryOutboxStore();
    const publisher = new FakePublisher();
    const outbox = new SyncOutbox(store, publisher);
    await outbox.queueChange(change('m1'));
    await outbox.queueChange(change('m2'));
    await outbox.queueChange(change('m3'));

    publisher.failOn = 'm2';
    expect(await outbox.publishPending()).toEqual({ published: 1, failed: 1, remaining: 2 });
    const [failed] = await store.pending();
    expect([failed?.entityId, failed?.attempts, failed?.lastError]).toEqual(['m2', 1, 'cloud rejected']);
    expect(publisher.sent).toEqual(['m1']);

    publisher.failOn = null;
    expect(await outbox.publishPending()).toEqual({ published: 2, failed: 0, remaining: 0 });
    expect(publisher.sent).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('MemberSync', () => {
  it('only queues changes for invited members, and always queues rates', async () => {
    const store = new InMemoryOutboxStore();
    const sync = new MemberSync(new SyncOutbox(store, new FakePublisher()), {
      isInvited: async (id) => id === 'invited',
    });
    const base = { operation: 'upsert' as const, payload: {} };

    expect(await sync.queueChange({ ...base, entity: 'member', entityId: 'a', memberId: 'invited' })).not.toBeNull();
    expect(await sync.queueChange({ ...base, entity: 'payment', entityId: 'p', memberId: 'other' })).toBeNull();
    expect(await sync.queueChange({ ...base, entity: 'payment', entityId: 'p2' })).toBeNull();
    expect(await sync.queueChange({ ...base, entity: 'rate', entityId: 'r1' })).not.toBeNull();
    expect((await store.pending()).map((i) => i.entityId)).toEqual(['a', 'r1']);
  });
});
