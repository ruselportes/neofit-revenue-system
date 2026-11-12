/** Observer: a small typed event emitter. A failing handler never breaks the emitter's owner. */
export class TypedEmitter<E extends { [K in keyof E]: unknown }> {
  private readonly handlers = new Map<keyof E, Set<(payload: never) => void>>();

  /** Returns a function that removes the handler. */
  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (payload: never) => void);
    this.handlers.set(event, set);
    return () => set.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      try {
        (handler as (p: E[K]) => void)(payload);
      } catch {
        // listeners are not allowed to break syncing
      }
    }
  }
}

/** Runs async jobs one at a time, so read-modify-write on storage never interleaves. */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job, job);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export interface IConnectivity {
  isOnline(): Promise<boolean>;
}
