import type { MemberChange, MemberSync } from '@neofit/core';

/**
 * Queues changes for the cloud and publishes them after every change and every five minutes.
 * Publishing is switched on only when a cloud publisher is configured; until then changes
 * wait in the outbox.
 */
export class CloudSyncCoordinator {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly sync: MemberSync,
    private publishing: boolean,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  async record(change: MemberChange): Promise<void> {
    await this.sync.queueChange(change);
    if (this.publishing) this.publishNow();
  }

  publishNow(): void {
    this.sync.publishPending().catch(this.onError);
  }

  start(intervalMs = 5 * 60_000): void {
    if (!this.publishing || this.timer) return;
    this.timer = setInterval(() => this.publishNow(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
