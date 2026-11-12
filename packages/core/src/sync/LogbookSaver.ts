import type { LogbookUpload } from '../domain';
import type { IUploadGateway, OfflineQueue } from './OfflineQueue';
import type { IConnectivity } from './support';

export type SaveOutcome = 'synced' | 'queued';

/** Saves a confirmed page: straight to the cloud when possible, otherwise into the offline queue. */
export class LogbookSaver {
  constructor(
    private readonly gateway: IUploadGateway,
    private readonly queue: OfflineQueue,
    private readonly connectivity: IConnectivity,
  ) {}

  async save(upload: LogbookUpload): Promise<SaveOutcome> {
    if (await this.connectivity.isOnline()) {
      try {
        await this.gateway.upsertUpload(upload);
        return 'synced';
      } catch {
        // fall through: the page must never be lost
      }
    }
    await this.queue.enqueue(upload);
    return 'queued';
  }
}
