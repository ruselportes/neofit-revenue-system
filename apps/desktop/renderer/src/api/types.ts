export type MemberStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Pending';

export interface Member {
  id: number;
  memberId: string;
  name: string;
  contact: string;
  email: string | null;
  plan: string;
  status: MemberStatus;
  joinedDate: string | null;
  expiryDate: string | null;
  address: string;
  photo: string | null;
  cloudId: string | null;
  invitedAt: string | null;
}

export interface Payment {
  id: string;
  memberId: number;
  receiptNo: string;
  amount: number;
  plan: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
}

export interface MemberSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  pending: number;
}

export interface MemberInput {
  name: string;
  contact: string;
  email?: string;
  address?: string;
  photo?: string;
  plan: string;
  joinedDate?: string;
  expiryDate?: string;
  amount?: number;
}

export interface Rate {
  category: string;
  type: string;
  monthly: number;
  semi: number;
  daily: number;
}

export interface RevenueDay {
  date: string;
  logbook: number;
  logbookCount: number;
  payments: number;
  paymentCount: number;
  total: number;
}

export interface LogbookRow {
  id: string;
  uploadId: string;
  name: string;
  amount: number | null;
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

export interface Announcement {
  id: string;
  title: string;
  body: string;
  postedAt: string;
}

export interface RevenueReport {
  /** True when the logbook could not be refreshed from the cloud. */
  logbookStale: boolean;
  year: number;
  month: number;
  total: number;
  logbookTotal: number;
  paymentsTotal: number;
  yearTotal: number;
  days: RevenueDay[];
  byCategory: Array<{ category: string; revenue: number }>;
  previous: { year: number; month: number; total: number; changePesos: number; changePercent: number | null };
}

export interface Session {
  token: string;
  email: string;
  role: string;
}
