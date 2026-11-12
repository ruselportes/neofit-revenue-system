/** Rows as the screens use them (camelCase), mapped from the database in the repositories. */

export type Role = 'staff' | 'owner';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface UploadSummary {
  id: string;
  /** Logbook date, YYYY-MM-DD. */
  date: string;
  staffId: string;
  staffName: string | null;
  totalEntries: number;
  totalAmount: number;
  createdAt: string;
  isSynced: boolean;
}

export interface EntryRow {
  id: string;
  name: string;
  amount: number | null;
  isDuplicate: boolean;
}

export type MembershipStatusText = 'Active' | 'Expiring Soon' | 'Expired' | 'Pending';

export interface MemberAccount {
  id: string;
  memberId: string;
  name: string;
  email: string;
  plan: string;
  status: MembershipStatusText;
  joinedDate: string | null;
  expiryDate: string | null;
  pushToken: string | null;
}

export interface MemberPaymentRecord {
  id: string;
  receiptNo: string;
  amount: number;
  plan: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
}

export interface RateRow {
  category: string;
  type: string;
  monthly: number;
  semi: number;
  daily: number;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  postedAt: string;
}
