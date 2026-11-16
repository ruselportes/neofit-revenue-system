import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import type { DateRange } from '@neofit/core';
import { CloudError, CloudUnavailableError } from '../errors';
import type { RateRecord } from '../models';
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
} from './ports';

export interface CloudCredentials {
  url: string;
  anonKey: string;
  ownerEmail: string;
  ownerPassword: string;
}

const PAGE = 1000;
const NETWORK = /fetch failed|network|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timed out/i;

/**
 * Makes the Supabase client. The packaged app runs this server on Electron's own Node (v20), which has no
 * built-in WebSocket, and the Supabase library refuses to start without one ("native WebSocket not found").
 * So the `ws` library is passed in explicitly. The desktop never uses realtime; the client just needs to exist.
 */
export function createCloudClient(credentials: Pick<CloudCredentials, 'url' | 'anonKey'>): SupabaseClient {
  return createClient(credentials.url, credentials.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
}

type WebSocketLikeConstructor = NonNullable<NonNullable<Parameters<typeof createClient>[2]>['realtime']>['transport'];

/**
 * The desktop's connection to Supabase. It signs in as the owner (the credentials come from
 * configuration, never from the source code) and signs in again shortly before the session ends.
 */
export class CloudSession {
  private client: SupabaseClient | null = null;
  private expiresAt = 0;
  private userId = '';

  constructor(private readonly credentials: CloudCredentials) {}

  async db(): Promise<SupabaseClient> {
    if (this.client && Date.now() < this.expiresAt - 60_000) return this.client;

    const client = createCloudClient(this.credentials);
    let result;
    try {
      result = await client.auth.signInWithPassword({
        email: this.credentials.ownerEmail,
        password: this.credentials.ownerPassword,
      });
    } catch (err) {
      throw wrap(err);
    }
    if (result.error || !result.data.session) throw wrap(result.error ?? new Error('Sign-in failed.'));

    this.client = client;
    this.userId = result.data.user.id;
    this.expiresAt = (result.data.session.expires_at ?? 0) * 1000;
    return client;
  }

  async ownerId(): Promise<string> {
    await this.db();
    return this.userId;
  }

  accessToken(): Promise<string> {
    return this.db().then(async (c) => (await c.auth.getSession()).data.session?.access_token ?? '');
  }
}

/** Turns a failure into CloudUnavailableError (no connection) or CloudError (the cloud refused). */
export function wrap(err: unknown): Error {
  const message = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  if (NETWORK.test(message)) return new CloudUnavailableError();
  return new CloudError(`Cloud request failed: ${message}`);
}

async function run<T>(work: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  let result;
  try {
    result = await work();
  } catch (err) {
    throw wrap(err);
  }
  if (result.error) throw wrap(result.error);
  return result.data;
}

const num = (v: unknown): number => Number(v ?? 0);

const toUpload = (r: Record<string, unknown>): CloudUpload => ({
  id: String(r.id),
  date: String(r.date),
  staffId: String(r.staff_id),
  totalEntries: num(r.total_entries),
  totalAmount: num(r.total_amount),
});

const toEntry = (r: Record<string, unknown>): CloudEntry => ({
  id: String(r.id),
  uploadId: String(r.upload_id),
  name: String(r.name),
  amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
  originalText: String(r.original_text ?? ''),
  createdAt: String(r.created_at),
});

class SupabaseLogbook implements ICloudLogbook {
  constructor(private readonly session: CloudSession) {}

  async uploads(range: DateRange): Promise<CloudUpload[]> {
    const db = await this.session.db();
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = await run(() =>
        db
          .from('logbook_uploads')
          .select('id, date, staff_id, total_entries, total_amount')
          .gte('date', range.start)
          .lte('date', range.end)
          .order('date')
          .order('id')
          .range(from, from + PAGE - 1),
      );
      const batch = (page ?? []) as Record<string, unknown>[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    return rows.map(toUpload);
  }

  async findUpload(id: string): Promise<CloudUpload | null> {
    const db = await this.session.db();
    const row = await run(() =>
      db.from('logbook_uploads').select('id, date, staff_id, total_entries, total_amount').eq('id', id).maybeSingle(),
    );
    return row ? toUpload(row as Record<string, unknown>) : null;
  }

  async entriesOfUploads(uploadIds: readonly string[]): Promise<CloudEntry[]> {
    const db = await this.session.db();
    const out: CloudEntry[] = [];
    for (let i = 0; i < uploadIds.length; i += 50) {
      const ids = uploadIds.slice(i, i + 50);
      for (let from = 0; ; from += PAGE) {
        const page = await run(() =>
          db
            .from('logbook_entries')
            .select('id, upload_id, name, amount, original_text, created_at')
            .in('upload_id', ids as string[])
            .order('created_at')
            .order('id')
            .range(from, from + PAGE - 1),
        );
        const batch = (page ?? []) as Record<string, unknown>[];
        out.push(...batch.map(toEntry));
        if (batch.length < PAGE) break;
      }
    }
    return out;
  }

  async findEntry(id: string): Promise<CloudEntry | null> {
    const db = await this.session.db();
    const row = await run(() =>
      db.from('logbook_entries').select('id, upload_id, name, amount, original_text, created_at').eq('id', id).maybeSingle(),
    );
    return row ? toEntry(row as Record<string, unknown>) : null;
  }

  ownerId(): Promise<string> {
    return this.session.ownerId();
  }

  async createUpload(upload: CloudUpload, entries: readonly NewCloudEntry[]): Promise<CloudEntry[]> {
    const db = await this.session.db();
    await run(() =>
      db.from('logbook_uploads').insert({
        id: upload.id,
        date: upload.date,
        staff_id: upload.staffId,
        total_entries: upload.totalEntries,
        total_amount: upload.totalAmount,
        is_synced: true,
        synced_at: new Date().toISOString(),
      }),
    );
    try {
      const rows = await run(() =>
        db
          .from('logbook_entries')
          .insert(entries.map((e) => ({ upload_id: upload.id, name: e.name, amount: e.amount, original_text: '', is_confirmed: true })))
          .select('id, upload_id, name, amount, original_text, created_at'),
      );
      return (rows as Record<string, unknown>[]).map(toEntry);
    } catch (err) {
      // Do not leave a page without its entries.
      await db.from('logbook_uploads').delete().eq('id', upload.id);
      throw err;
    }
  }

  async updateEntry(id: string, change: NewCloudEntry): Promise<CloudEntry> {
    const db = await this.session.db();
    const row = await run(() =>
      db
        .from('logbook_entries')
        .update({ name: change.name, amount: change.amount })
        .eq('id', id)
        .select('id, upload_id, name, amount, original_text, created_at')
        .single(),
    );
    return toEntry(row as Record<string, unknown>);
  }

  async deleteEntry(id: string): Promise<void> {
    const db = await this.session.db();
    await run(() => db.from('logbook_entries').delete().eq('id', id));
  }

  async updateUploadTotals(id: string, totalEntries: number, totalAmount: number): Promise<void> {
    const db = await this.session.db();
    await run(() => db.from('logbook_uploads').update({ total_entries: totalEntries, total_amount: totalAmount }).eq('id', id));
  }

  async deleteUpload(id: string): Promise<void> {
    const db = await this.session.db();
    await run(() => db.from('logbook_uploads').delete().eq('id', id));
  }
}

class SupabaseMembers implements ICloudMembers {
  constructor(
    private readonly session: CloudSession,
    private readonly credentials: CloudCredentials,
  ) {}

  async upsertAccount(row: MemberAccountRow): Promise<void> {
    const db = await this.session.db();
    await run(() =>
      db.from('member_accounts').upsert(
        {
          id: row.id,
          member_id: row.memberId,
          name: row.name,
          email: row.email,
          plan: row.plan,
          status: row.status,
          joined_date: row.joinedDate,
          expiry_date: row.expiryDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      ),
    );
  }

  async upsertPayment(row: MemberPaymentRow): Promise<void> {
    const db = await this.session.db();
    await run(() =>
      db.from('member_payments').upsert(
        {
          id: row.id,
          account_id: row.accountId,
          receipt_no: row.receiptNo,
          amount: row.amount,
          plan: row.plan,
          period_start: row.periodStart,
          period_end: row.periodEnd,
          paid_at: row.paidAt,
        },
        { onConflict: 'id' },
      ),
    );
  }

  async upsertRates(rates: readonly RateRecord[]): Promise<void> {
    const db = await this.session.db();
    const now = new Date().toISOString();
    await run(() =>
      db.from('rates').upsert(
        rates.map((r) => ({ category: r.category, type: r.type, monthly: r.monthly, semi: r.semi, daily: r.daily, updated_at: now })),
        { onConflict: 'category,type' },
      ),
    );
  }

  invite(accountId: string): Promise<InviteResult> {
    return this.callFunction<InviteResult>({ action: 'invite', accountId });
  }

  async removeAccount(accountId: string): Promise<void> {
    await this.callFunction({ action: 'remove', accountId });
  }

  private async callFunction<T>(body: unknown): Promise<T> {
    const token = await this.session.accessToken();
    let res: Response;
    try {
      res = await fetch(`${this.credentials.url}/functions/v1/member-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: this.credentials.anonKey },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw wrap(err);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
    if (!res.ok) throw new CloudError(data.error ?? `The member-access function failed (${res.status}).`);
    return data as T;
  }
}

class SupabaseAnnouncements implements ICloudAnnouncements {
  constructor(private readonly session: CloudSession) {}

  async list(): Promise<Announcement[]> {
    const db = await this.session.db();
    const rows = await run(() => db.from('announcements').select('id, title, body, posted_at').order('posted_at', { ascending: false }));
    return (rows as Record<string, unknown>[]).map(toAnnouncement);
  }

  async post(title: string, body: string): Promise<Announcement> {
    const db = await this.session.db();
    const row = await run(() => db.from('announcements').insert({ title, body }).select('id, title, body, posted_at').single());
    return toAnnouncement(row as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    const db = await this.session.db();
    await run(() => db.from('announcements').delete().eq('id', id));
  }
}

const toAnnouncement = (r: Record<string, unknown>): Announcement => ({
  id: String(r.id),
  title: String(r.title),
  body: String(r.body),
  postedAt: String(r.posted_at),
});

/** All cloud features of the desktop, over one owner session. */
export class SupabaseCloud implements ICloud {
  readonly logbook: ICloudLogbook;
  readonly members: ICloudMembers;
  readonly announcements: ICloudAnnouncements;

  constructor(credentials: CloudCredentials) {
    const session = new CloudSession(credentials);
    this.logbook = new SupabaseLogbook(session);
    this.members = new SupabaseMembers(session, credentials);
    this.announcements = new SupabaseAnnouncements(session);
  }
}
