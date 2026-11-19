export type MemberStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Pending';

export interface MemberRecord {
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
  createdAt: string;
  updatedAt: string;
}

export type NewMember = Pick<MemberRecord, 'memberId' | 'name' | 'contact' | 'email' | 'plan' | 'status' | 'joinedDate' | 'expiryDate' | 'address' | 'photo'>;

export interface PaymentRecord {
  id: string;
  memberId: number;
  receiptNo: string;
  amount: number;
  plan: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
}

export interface PaymentWithMember extends PaymentRecord {
  memberName: string;
}

export interface RateRecord {
  category: string;
  type: string;
  monthly: number;
  semi: number;
  daily: number;
}

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  /** Hash of the recovery key; null until the administrator has one. */
  recoveryHash: string | null;
  /** Goes up on sign-out and on a password reset; a login made before that stops working. */
  sessionVersion: number;
  role: string;
}

export interface GymSettings {
  gymName: string;
  contact: string;
  address: string;
}
