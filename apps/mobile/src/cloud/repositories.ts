import type { SupabaseClient } from '@supabase/supabase-js';
import type { IUploadGateway, LogbookUpload, UploadTotal } from '@neofit/core';
import { v5 as uuidv5 } from 'uuid';
import type {
  AnnouncementRow,
  EntryRow,
  MemberAccount,
  MemberPaymentRecord,
  MembershipStatusText,
  Profile,
  RateRow,
  UploadSummary,
} from './types';

const PAGE = 1000;

/** A failed cloud call. The message is the database's; the screens show it as is. */
export class CloudFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudFailure';
  }
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new CloudFailure(result.error.message);
  return result.data;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const text = (v: unknown) => (v === null || v === undefined ? null : String(v));

/** Reads every page of a long list (the API returns at most 1,000 rows at a time). */
async function readAll(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = (check(await fetchPage(from, from + PAGE - 1)) ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const toSummary = (r: Row): UploadSummary => ({
  id: String(r.id),
  date: String(r.date),
  staffId: String(r.staff_id),
  staffName: text((r.profiles as { full_name?: string } | null)?.full_name),
  totalEntries: num(r.total_entries),
  totalAmount: num(r.total_amount),
  createdAt: String(r.created_at ?? ''),
  isSynced: r.is_synced === true,
});

/** Logbook pages in the cloud. It is also the gateway the offline queue sends pages through. */
export class UploadRepository implements IUploadGateway {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Saves a page and its entries. Both use fixed ids (the entry ids come from the page id and the
   * row number), so sending the same page twice replaces it and never creates duplicate rows.
   */
  async upsertUpload(upload: LogbookUpload): Promise<void> {
    check(
      await this.db.from('logbook_uploads').upsert(
        {
          id: upload.id,
          date: upload.date,
          staff_id: upload.staffId,
          total_entries: upload.totalEntries,
          total_amount: upload.totalAmount.pesos,
          is_synced: true,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      ),
    );
    if (upload.entries.length === 0) return;
    check(
      await this.db.from('logbook_entries').upsert(
        upload.entries.map((e, i) => ({
          id: uuidv5(String(i), upload.id),
          upload_id: upload.id,
          original_text: e.originalText,
          name: e.name,
          amount: e.amount ? e.amount.pesos : null,
          is_confirmed: true,
          is_duplicate: e.isDuplicate,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  /** The signed-in staff member's own pages, newest first. */
  async mine(staffId: string, limit = 200): Promise<UploadSummary[]> {
    const rows = check(
      await this.db
        .from('logbook_uploads')
        .select('id, date, staff_id, total_entries, total_amount, created_at, is_synced')
        .eq('staff_id', staffId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit),
    );
    return ((rows ?? []) as Row[]).map(toSummary);
  }

  /** Every page from every staff member, newest first, with the staff member's name. */
  async all(limit = 200): Promise<UploadSummary[]> {
    const rows = check(
      await this.db
        .from('logbook_uploads')
        .select('id, date, staff_id, total_entries, total_amount, created_at, is_synced, profiles(full_name)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit),
    );
    return ((rows ?? []) as unknown as Row[]).map(toSummary);
  }

  async entriesOf(uploadId: string): Promise<EntryRow[]> {
    const rows = check(
      await this.db.from('logbook_entries').select('id, name, amount, is_duplicate').eq('upload_id', uploadId).order('created_at').order('id'),
    );
    return ((rows ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      amount: r.amount === null ? null : num(r.amount),
      isDuplicate: r.is_duplicate === true,
    }));
  }

  /** Totals per page since a date, for the owner's Dashboard. */
  async totalsSince(from: string): Promise<UploadTotal[]> {
    const rows = await readAll((a, b) =>
      this.db
        .from('logbook_uploads')
        .select('date, total_amount, total_entries')
        .gte('date', from)
        .eq('is_synced', true)
        .order('date')
        .order('id')
        .range(a, b),
    );
    return rows.map((r) => ({ date: String(r.date), total: num(r.total_amount), entries: num(r.total_entries) }));
  }
}

const toProfile = (r: Row): Profile => ({
  id: String(r.id),
  email: String(r.email),
  fullName: String(r.full_name),
  role: r.role === 'owner' ? 'owner' : 'staff',
  isActive: r.is_active !== false,
});

export class ProfileRepository {
  constructor(private readonly db: SupabaseClient) {}

  async get(id: string): Promise<Profile | null> {
    const row = check(await this.db.from('profiles').select('id, email, full_name, role, is_active').eq('id', id).maybeSingle());
    return row ? toProfile(row as Row) : null;
  }

  /** The staff accounts (not owners), for Staff Management. */
  async staff(): Promise<Profile[]> {
    const rows = check(
      await this.db.from('profiles').select('id, email, full_name, role, is_active').eq('role', 'staff').order('full_name'),
    );
    return ((rows ?? []) as Row[]).map(toProfile);
  }

  /** Only an owner may do this: the database refuses anyone else. */
  async setActive(id: string, isActive: boolean): Promise<void> {
    const rows = check(await this.db.from('profiles').update({ is_active: isActive }).eq('id', id).select('id'));
    if (!rows || rows.length === 0) throw new CloudFailure('The account could not be changed.');
  }

  async rename(id: string, fullName: string): Promise<void> {
    const rows = check(await this.db.from('profiles').update({ full_name: fullName }).eq('id', id).select('id'));
    if (!rows || rows.length === 0) throw new CloudFailure('Your name could not be saved.');
  }
}

const toAccount = (r: Row): MemberAccount => ({
  id: String(r.id),
  memberId: String(r.member_id),
  name: String(r.name),
  email: String(r.email),
  plan: String(r.plan),
  status: String(r.status) as MembershipStatusText,
  joinedDate: text(r.joined_date),
  expiryDate: text(r.expiry_date),
  pushToken: text(r.push_token),
});

/** What the member screens read. Row-Level Security limits every query to the member's own rows. */
export class MemberRepository {
  constructor(private readonly db: SupabaseClient) {}

  async accountForUser(userId: string): Promise<MemberAccount | null> {
    const row = check(
      await this.db
        .from('member_accounts')
        .select('id, member_id, name, email, plan, status, joined_date, expiry_date, push_token')
        .eq('user_id', userId)
        .maybeSingle(),
    );
    return row ? toAccount(row as Row) : null;
  }

  /** The member's own row again, for pull-to-refresh. */
  async accountById(id: string): Promise<MemberAccount | null> {
    const row = check(
      await this.db
        .from('member_accounts')
        .select('id, member_id, name, email, plan, status, joined_date, expiry_date, push_token')
        .eq('id', id)
        .maybeSingle(),
    );
    return row ? toAccount(row as Row) : null;
  }

  async payments(accountId: string): Promise<MemberPaymentRecord[]> {
    const rows = check(
      await this.db
        .from('member_payments')
        .select('id, receipt_no, amount, plan, period_start, period_end, paid_at')
        .eq('account_id', accountId)
        .order('paid_at', { ascending: false }),
    );
    return ((rows ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      receiptNo: String(r.receipt_no),
      amount: num(r.amount),
      plan: String(r.plan),
      periodStart: text(r.period_start),
      periodEnd: text(r.period_end),
      paidAt: String(r.paid_at),
    }));
  }

  async rates(): Promise<RateRow[]> {
    const rows = check(await this.db.from('rates').select('category, type, monthly, semi, daily').order('category').order('type'));
    return ((rows ?? []) as Row[]).map((r) => ({
      category: String(r.category),
      type: String(r.type),
      monthly: num(r.monthly),
      semi: num(r.semi),
      daily: num(r.daily),
    }));
  }

  async announcements(): Promise<AnnouncementRow[]> {
    const rows = check(await this.db.from('announcements').select('id, title, body, posted_at').order('posted_at', { ascending: false }));
    return ((rows ?? []) as Row[]).map((r) => ({ id: String(r.id), title: String(r.title), body: String(r.body), postedAt: String(r.posted_at) }));
  }

  /** The one field a member may change. */
  async savePushToken(accountId: string, token: string | null): Promise<void> {
    check(await this.db.from('member_accounts').update({ push_token: token }).eq('id', accountId));
  }
}
