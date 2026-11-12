import { ValidationError } from '../errors';
import { LogbookEntry, type LogbookEntryJSON } from './LogbookEntry';
import type { Money } from './Money';

export interface LogbookUploadJSON {
  id: string;
  date: string;
  staffId: string;
  entries: LogbookEntryJSON[];
}

/** One confirmed logbook page. The id is generated on the phone, so a queued page keeps it. */
export class LogbookUpload {
  constructor(
    readonly id: string,
    /** Logbook date, YYYY-MM-DD. May be earlier than the day of the scan. */
    readonly date: string,
    readonly staffId: string,
    readonly entries: readonly LogbookEntry[],
  ) {
    if (!id) throw new ValidationError('Upload id is required.');
    if (!staffId) throw new ValidationError('Upload staff id is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError(`Invalid logbook date: ${date}`);
  }

  get totalEntries(): number {
    return this.entries.length;
  }

  get totalAmount(): Money {
    return LogbookEntry.total(this.entries);
  }

  toJSON(): LogbookUploadJSON {
    return {
      id: this.id,
      date: this.date,
      staffId: this.staffId,
      entries: this.entries.map((e) => e.toJSON()),
    };
  }

  static fromJSON(json: LogbookUploadJSON): LogbookUpload {
    return new LogbookUpload(json.id, json.date, json.staffId, json.entries.map(LogbookEntry.fromJSON));
  }
}
