import { randomUUID } from 'node:crypto';
import { LogbookEntry, Money, ValidationError, type DateRange, type IClock, type LogbookRecord } from '@neofit/core';
import type { CloudEntry, CloudUpload, ICloudLogbook, NewCloudEntry } from '../cloud/ports';
import { CloudUnavailableError, NotFoundError } from '../errors';
import type { LogbookBackupRepository } from '../repositories/LogbookBackupRepository';
import { formatDate, isDateText } from '../util/dates';
import { Body } from '../util/validate';
import type { ILogbookRecords } from './RevenueService';

export interface LogbookRow {
  id: string;
  uploadId: string;
  name: string;
  amount: number | null;
  /** 'scan' for pages read from the logbook, 'manual' for entries typed on the desktop. */
  source: 'scan' | 'manual';
  createdAt: string;
}

export interface LogbookDay {
  date: string;
  count: number;
  total: number;
  entries: LogbookRow[];
}

export interface DayTotal {
  date: string;
  count: number;
  total: number;
}

const MAX_ENTRIES_PER_REQUEST = 200;

/**
 * The synchronized logbook (SDD Section 4.9). Reads pages from the cloud with a 60-second
 * cache, corrects them, recomputes each page's totals, and mirrors added or edited entries
 * into the local backup table.
 */
export class LogbookService implements ILogbookRecords {
  static readonly CACHE_MS = 60_000;

  private cache = new Map<string, { at: number; records: LogbookRecord[] }>();
  private stale = false;

  constructor(
    private readonly cloud: ICloudLogbook,
    private readonly backup: LogbookBackupRepository,
    private readonly clock: IClock,
  ) {}

  /** True when the last read could not reach the cloud, so the logbook figures may be missing or old. */
  isStale(): boolean {
    return this.stale;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ---- Reading ----

  /** Pages with their entries, for the revenue engine. If the cloud cannot be reached, the last copy is used. */
  async logbookRecords(range: DateRange): Promise<LogbookRecord[]> {
    const key = `${range.start}|${range.end}`;
    const hit = this.cache.get(key);
    const now = this.clock.now().getTime();
    if (hit && now - hit.at < LogbookService.CACHE_MS) return hit.records;

    try {
      const uploads = await this.cloud.uploads(range);
      const entries = await this.cloud.entriesOfUploads(uploads.map((u) => u.id));
      const records = this.toRecords(uploads, entries);
      this.cache.set(key, { at: now, records });
      this.stale = false;
      return records;
    } catch (err) {
      if (!(err instanceof CloudUnavailableError)) throw err;
      this.stale = true;
      return hit?.records ?? [];
    }
  }

  async day(date: string): Promise<LogbookDay> {
    this.requireDate(date);
    const uploads = await this.cloud.uploads({ start: date, end: date });
    const entries = await this.cloud.entriesOfUploads(uploads.map((u) => u.id));
    const rows = entries
      .map((e): LogbookRow => ({
        id: e.id,
        uploadId: e.uploadId,
        name: e.name,
        amount: e.amount,
        source: e.originalText.trim() === '' ? 'manual' : 'scan',
        createdAt: e.createdAt,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { date, count: rows.length, total: rows.reduce((s, r) => s + (r.amount ?? 0), 0), entries: rows };
  }

  /** The total of every day of the month that has entries, for the calendar. */
  async monthTotals(year: number, month: number): Promise<DayTotal[]> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new ValidationError('Invalid year.');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new ValidationError('Invalid month.');
    const mm = String(month).padStart(2, '0');
    const last = new Date(year, month, 0).getDate();
    const uploads = await this.cloud.uploads({ start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` });

    const days = new Map<string, DayTotal>();
    for (const u of uploads) {
      const d = days.get(u.date) ?? { date: u.date, count: 0, total: 0 };
      d.count += u.totalEntries;
      d.total += u.totalAmount;
      days.set(u.date, d);
    }
    return [...days.values()].filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---- Changing ----

  /** Adds entries typed by hand. They go on a new page for that date. */
  async addEntries(raw: unknown): Promise<LogbookDay> {
    const body = new Body(raw);
    const date = body.string('date', 10);
    this.requireDate(date);
    // A page is written after the payments happen, so a date that has not arrived yet is a mistake.
    if (date > formatDate(this.clock.now())) throw new ValidationError('The logbook date cannot be in the future.');
    const list = body.array('entries');
    if (list.length === 0 || list.length > MAX_ENTRIES_PER_REQUEST) {
      throw new ValidationError(`Send between 1 and ${MAX_ENTRIES_PER_REQUEST} entries.`);
    }
    const entries = list.map((item) => this.entryInput(item));
    const upload: CloudUpload = {
      id: randomUUID(),
      date,
      staffId: await this.cloud.ownerId(),
      totalEntries: entries.length,
      totalAmount: entries.reduce((s, e) => s + (e.amount ?? 0), 0),
    };
    const created = await this.cloud.createUpload(upload, entries);
    for (const e of created) this.mirror(e, date);
    this.clearCache();
    return this.day(date);
  }

  async updateEntry(id: string, raw: unknown): Promise<LogbookRow> {
    const existing = await this.requireEntry(id);
    const change = this.entryInput(raw);
    const updated = await this.cloud.updateEntry(id, change);
    const upload = await this.requireUpload(existing.uploadId);
    await this.recompute(upload.id);
    this.mirror(updated, upload.date);
    this.clearCache();
    return {
      id: updated.id,
      uploadId: updated.uploadId,
      name: updated.name,
      amount: updated.amount,
      source: updated.originalText.trim() === '' ? 'manual' : 'scan',
      createdAt: updated.createdAt,
    };
  }

  /** Deletes an entry. A page left without entries is deleted too. */
  async deleteEntry(id: string): Promise<void> {
    const existing = await this.requireEntry(id);
    await this.cloud.deleteEntry(id);
    this.backup.remove(id);
    await this.recompute(existing.uploadId);
    this.clearCache();
  }

  /** Deletes every entry of a date. */
  async deleteDate(date: string): Promise<number> {
    this.requireDate(date);
    const uploads = await this.cloud.uploads({ start: date, end: date });
    const entries = await this.cloud.entriesOfUploads(uploads.map((u) => u.id));
    for (const u of uploads) {
      await this.cloud.deleteUpload(u.id);
      this.backup.removeUpload(u.id);
    }
    this.clearCache();
    return entries.length;
  }

  // ---- Helpers ----

  /** Brings a page's entry count and total back in line with its entries; removes an empty page. */
  private async recompute(uploadId: string): Promise<void> {
    const entries = await this.cloud.entriesOfUploads([uploadId]);
    if (entries.length === 0) {
      await this.cloud.deleteUpload(uploadId);
      this.backup.removeUpload(uploadId);
      return;
    }
    await this.cloud.updateUploadTotals(uploadId, entries.length, entries.reduce((s, e) => s + (e.amount ?? 0), 0));
  }

  private mirror(e: CloudEntry, date: string): void {
    this.backup.upsert({ id: e.id, date, name: e.name, amount: e.amount ?? 0, uploadId: e.uploadId, createdAt: e.createdAt });
  }

  private toRecords(uploads: CloudUpload[], entries: CloudEntry[]): LogbookRecord[] {
    const byUpload = new Map<string, LogbookEntry[]>();
    for (const e of entries) {
      const list = byUpload.get(e.uploadId) ?? [];
      list.push(new LogbookEntry(e.name.trim() || 'Unknown', e.amount, e.originalText));
      byUpload.set(e.uploadId, list);
    }
    return uploads.map((u) => ({
      date: u.date,
      totalAmount: Money.pesos(u.totalAmount),
      entryCount: u.totalEntries,
      entries: byUpload.get(u.id) ?? [],
    }));
  }

  private entryInput(raw: unknown): NewCloudEntry {
    const b = new Body(raw);
    const amount = b.optionalNumber('amount');
    if (amount !== undefined && amount < 0) throw new ValidationError('amount cannot be negative.');
    return { name: b.string('name', 100), amount: amount ?? null };
  }

  private requireDate(date: string): void {
    if (!isDateText(date)) throw new ValidationError('date must be in the form YYYY-MM-DD.');
  }

  private async requireEntry(id: string): Promise<CloudEntry> {
    const entry = await this.cloud.findEntry(id);
    if (!entry) throw new NotFoundError('Entry not found.');
    return entry;
  }

  private async requireUpload(id: string): Promise<CloudUpload> {
    const upload = await this.cloud.findUpload(id);
    if (!upload) throw new NotFoundError('Page not found.');
    return upload;
  }
}
