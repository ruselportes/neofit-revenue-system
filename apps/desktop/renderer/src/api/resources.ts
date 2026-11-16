import type { ApiClient } from './ApiClient';
import type {
  Announcement,
  DayTotal,
  LogbookDay,
  LogbookRow,
  Member,
  MemberInput,
  MemberSummary,
  Payment,
  Rate,
  RevenueReport,
  Session,
  SessionWithKey,
} from './types';

/** One class per area of the API, so views never build URLs themselves. */
export class AuthApi {
  constructor(private readonly http: ApiClient) {}

  needsSetup(): Promise<{ needsSetup: boolean }> {
    return this.http.get('/api/setup/status');
  }
  login(email: string, password: string): Promise<Session> {
    return this.http.post('/api/login', { email, password });
  }
  setup(email: string, password: string): Promise<SessionWithKey> {
    return this.http.post('/api/setup', { email, password });
  }
  /** Forgot password: the recovery key sets a new password and is replaced by a new key. */
  resetPassword(email: string, recoveryKey: string, newPassword: string): Promise<SessionWithKey> {
    return this.http.post('/api/reset-password', { email, recoveryKey, newPassword });
  }
  /** Makes a new recovery key for the signed-in administrator (the old one stops working). */
  newRecoveryKey(password: string): Promise<{ recoveryKey: string }> {
    return this.http.post('/api/recovery-key', { password });
  }
}

export class MembersApi {
  constructor(private readonly http: ApiClient) {}

  list(): Promise<Member[]> {
    return this.http.get('/api/members');
  }
  summary(): Promise<MemberSummary> {
    return this.http.get('/api/members/summary');
  }
  payments(id: number): Promise<Payment[]> {
    return this.http.get(`/api/members/${id}/payments`);
  }
  create(input: MemberInput): Promise<{ member: Member; payment: Payment }> {
    return this.http.post('/api/members', input);
  }
  update(id: number, input: Partial<MemberInput>): Promise<Member> {
    return this.http.put(`/api/members/${id}`, input);
  }
  renew(id: number, input: { plan?: string; amount?: number } = {}): Promise<{ member: Member; payment: Payment }> {
    return this.http.post(`/api/members/${id}/renew`, input);
  }
  remove(id: number): Promise<void> {
    return this.http.delete(`/api/members/${id}`);
  }
}

export class RatesApi {
  constructor(private readonly http: ApiClient) {}

  list(): Promise<Rate[]> {
    return this.http.get('/api/rates');
  }
  save(rates: Rate[]): Promise<Rate[]> {
    return this.http.put('/api/rates', { rates });
  }
  reset(): Promise<Rate[]> {
    return this.http.post('/api/rates/reset');
  }
}

export class RevenueApi {
  constructor(private readonly http: ApiClient) {}

  month(year: number, month: number): Promise<RevenueReport> {
    return this.http.get(`/api/revenue?year=${year}&month=${month}`);
  }
  /** The month's report as a Word file. */
  report(year: number, month: number): Promise<Blob> {
    return this.http.download(`/api/revenue/report?year=${year}&month=${month}`);
  }
}

/** Features that need the cloud connection. Each call fails with a clear message when it is not set up. */
export class CloudApi {
  constructor(private readonly http: ApiClient) {}

  status(): Promise<{ configured: boolean }> {
    return this.http.get('/api/cloud/status');
  }
  invite(memberId: number, email?: string): Promise<{ member: Member; status: 'invited' | 'resent' }> {
    return this.http.post(`/api/members/${memberId}/invite`, email ? { email } : {});
  }

  announcements(): Promise<Announcement[]> {
    return this.http.get('/api/announcements');
  }
  postAnnouncement(title: string, body: string): Promise<Announcement> {
    return this.http.post('/api/announcements', { title, body });
  }
  removeAnnouncement(id: string): Promise<void> {
    return this.http.delete(`/api/announcements/${id}`);
  }

  logbookDay(date: string): Promise<LogbookDay> {
    return this.http.get(`/api/logbook?date=${date}`);
  }
  logbookTotals(year: number, month: number): Promise<DayTotal[]> {
    return this.http.get(`/api/logbook/totals?year=${year}&month=${month}`);
  }
  addLogbookEntries(date: string, entries: Array<{ name: string; amount?: number }>): Promise<LogbookDay> {
    return this.http.post('/api/logbook/entries', { date, entries });
  }
  updateLogbookEntry(id: string, entry: { name: string; amount?: number }): Promise<LogbookRow> {
    return this.http.put(`/api/logbook/entries/${id}`, entry);
  }
  deleteLogbookEntry(id: string): Promise<void> {
    return this.http.delete(`/api/logbook/entries/${id}`);
  }
  deleteLogbookDate(date: string): Promise<void> {
    return this.http.delete(`/api/logbook?date=${date}`);
  }
}

/** Everything the views need, built once from one client. */
export class Api {
  readonly auth: AuthApi;
  readonly members: MembersApi;
  readonly rates: RatesApi;
  readonly revenue: RevenueApi;
  readonly cloud: CloudApi;

  constructor(readonly http: ApiClient) {
    this.cloud = new CloudApi(http);
    this.auth = new AuthApi(http);
    this.members = new MembersApi(http);
    this.rates = new RatesApi(http);
    this.revenue = new RevenueApi(http);
  }
}
