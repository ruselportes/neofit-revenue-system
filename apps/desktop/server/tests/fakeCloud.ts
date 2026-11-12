import { randomUUID } from 'node:crypto';
import type { DateRange } from '@neofit/core';
import type {
  Announcement,
  CloudEntry,
  CloudUpload,
  ICloud,
  ICloudAnnouncements,
  ICloudLogbook,
  ICloudMembers,
  InviteResult,
  MemberAccountRow,
  MemberPaymentRow,
  NewCloudEntry,
} from '../src/cloud/ports';
import { CloudUnavailableError } from '../src/errors';
import type { RateRecord } from '../src/models';

/** In-memory stand-in for Supabase. `offline = true` makes every call fail like a lost connection. */
export class FakeCloud implements ICloud {
  offline = false;
  uploadsById = new Map<string, CloudUpload>();
  entriesById = new Map<string, CloudEntry>();
  accounts = new Map<string, MemberAccountRow>();
  payments = new Map<string, MemberPaymentRow>();
  rates: RateRecord[] = [];
  invites: string[] = [];
  removed: string[] = [];
  announcementList: Announcement[] = [];
  calls = { uploads: 0 };
  private tick = 0;

  private guard(): void {
    if (this.offline) throw new CloudUnavailableError();
  }

  /** Test helper: a page as the phone would have uploaded it. */
  seedPage(date: string, rows: Array<[string, number | null]>, scanned = true): CloudUpload {
    const upload: CloudUpload = {
      id: randomUUID(),
      date,
      staffId: 'staff-1',
      totalEntries: rows.length,
      totalAmount: rows.reduce((s, [, a]) => s + (a ?? 0), 0),
    };
    this.uploadsById.set(upload.id, upload);
    for (const [name, amount] of rows) {
      const id = randomUUID();
      this.entriesById.set(id, {
        id,
        uploadId: upload.id,
        name,
        amount,
        originalText: scanned ? `${name} - ${amount ?? ''}` : '',
        createdAt: new Date(Date.UTC(2026, 10, 4, 1, 0, this.tick++)).toISOString(),
      });
    }
    return upload;
  }

  readonly logbook: ICloudLogbook = {
    uploads: async (range: DateRange) => {
      this.guard();
      this.calls.uploads++;
      return [...this.uploadsById.values()].filter((u) => u.date >= range.start && u.date <= range.end);
    },
    findUpload: async (id) => (this.guard(), this.uploadsById.get(id) ?? null),
    entriesOfUploads: async (ids) => (this.guard(), [...this.entriesById.values()].filter((e) => ids.includes(e.uploadId))),
    findEntry: async (id) => (this.guard(), this.entriesById.get(id) ?? null),
    ownerId: async () => 'owner-1',
    createUpload: async (upload: CloudUpload, entries: readonly NewCloudEntry[]) => {
      this.guard();
      this.uploadsById.set(upload.id, upload);
      return entries.map((e) => {
        const entry: CloudEntry = {
          id: randomUUID(),
          uploadId: upload.id,
          name: e.name,
          amount: e.amount,
          originalText: '',
          createdAt: new Date(Date.UTC(2026, 10, 4, 2, 0, this.tick++)).toISOString(),
        };
        this.entriesById.set(entry.id, entry);
        return entry;
      });
    },
    updateEntry: async (id, change) => {
      this.guard();
      const next = { ...this.entriesById.get(id)!, name: change.name, amount: change.amount };
      this.entriesById.set(id, next);
      return next;
    },
    deleteEntry: async (id) => (this.guard(), void this.entriesById.delete(id)),
    updateUploadTotals: async (id, totalEntries, totalAmount) => {
      this.guard();
      this.uploadsById.set(id, { ...this.uploadsById.get(id)!, totalEntries, totalAmount });
    },
    deleteUpload: async (id) => {
      this.guard();
      this.uploadsById.delete(id);
      for (const e of [...this.entriesById.values()]) if (e.uploadId === id) this.entriesById.delete(e.id);
    },
  };

  readonly members: ICloudMembers = {
    upsertAccount: async (row: MemberAccountRow) => (this.guard(), void this.accounts.set(row.id, row)),
    upsertPayment: async (row: MemberPaymentRow) => (this.guard(), void this.payments.set(row.id, row)),
    upsertRates: async (rates) => (this.guard(), void (this.rates = [...rates])),
    invite: async (accountId): Promise<InviteResult> => {
      this.guard();
      const again = this.invites.includes(accountId);
      this.invites.push(accountId);
      return { status: again ? 'resent' : 'invited', invitedAt: '2026-11-04T10:00:00.000Z' };
    },
    removeAccount: async (accountId) => {
      this.guard();
      this.removed.push(accountId);
      this.accounts.delete(accountId);
    },
  };

  readonly announcements: ICloudAnnouncements = {
    list: async () => (this.guard(), [...this.announcementList].reverse()),
    post: async (title, body) => {
      this.guard();
      const a: Announcement = { id: randomUUID(), title, body, postedAt: '2026-11-04T10:00:00.000Z' };
      this.announcementList.push(a);
      return a;
    },
    remove: async (id) => (this.guard(), void (this.announcementList = this.announcementList.filter((a) => a.id !== id))),
  };
}
