import type { DateRange } from '@neofit/core';
import type { RateRecord } from '../models';

/** What the desktop needs from the cloud. Supabase implements it; tests use a fake. */

export interface CloudUpload {
  id: string;
  date: string;
  staffId: string;
  totalEntries: number;
  totalAmount: number;
}

export interface CloudEntry {
  id: string;
  uploadId: string;
  name: string;
  amount: number | null;
  originalText: string;
  createdAt: string;
}

export interface NewCloudEntry {
  name: string;
  amount: number | null;
}

export interface ICloudLogbook {
  uploads(range: DateRange): Promise<CloudUpload[]>;
  findUpload(id: string): Promise<CloudUpload | null>;
  entriesOfUploads(uploadIds: readonly string[]): Promise<CloudEntry[]>;
  findEntry(id: string): Promise<CloudEntry | null>;
  /** The signed-in owner's id, used as the staff of pages added by hand. */
  ownerId(): Promise<string>;
  createUpload(upload: CloudUpload, entries: readonly NewCloudEntry[]): Promise<CloudEntry[]>;
  updateEntry(id: string, change: NewCloudEntry): Promise<CloudEntry>;
  deleteEntry(id: string): Promise<void>;
  updateUploadTotals(id: string, totalEntries: number, totalAmount: number): Promise<void>;
  /** Deletes the page and, with it, its entries. */
  deleteUpload(id: string): Promise<void>;
}

export interface MemberAccountRow {
  id: string;
  memberId: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  joinedDate: string | null;
  expiryDate: string | null;
}

export interface MemberPaymentRow {
  id: string;
  accountId: string;
  receiptNo: string;
  amount: number;
  plan: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
}

export interface InviteResult {
  status: 'invited' | 'resent';
  invitedAt: string;
}

export interface ICloudMembers {
  upsertAccount(row: MemberAccountRow): Promise<void>;
  upsertPayment(row: MemberPaymentRow): Promise<void>;
  upsertRates(rates: readonly RateRecord[]): Promise<void>;
  invite(accountId: string): Promise<InviteResult>;
  /** Removes the member's cloud copy and sign-in account. */
  removeAccount(accountId: string): Promise<void>;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  postedAt: string;
}

export interface ICloudAnnouncements {
  list(): Promise<Announcement[]>;
  post(title: string, body: string): Promise<Announcement>;
  remove(id: string): Promise<void>;
}

export interface ICloud {
  readonly logbook: ICloudLogbook;
  readonly members: ICloudMembers;
  readonly announcements: ICloudAnnouncements;
}
