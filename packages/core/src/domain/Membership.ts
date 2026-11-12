export type MembershipStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Pending';

/** Days from one YYYY-MM-DD date to another (negative when `to` is earlier). Works on calendar days, never time zones. */
export function daysBetween(from: string, to: string): number {
  const at = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((at(to) - at(from)) / 86_400_000);
}

export const EXPIRING_SOON_DAYS = 7;

/** Table 23.0: how a membership's status follows from its dates. */
export function statusFor(joinedDate: string | null, expiryDate: string | null, today: string): MembershipStatus {
  if (joinedDate && joinedDate > today) return 'Pending';
  if (expiryDate && expiryDate < today) return 'Expired';
  if (expiryDate && daysBetween(today, expiryDate) <= EXPIRING_SOON_DAYS) return 'Expiring Soon';
  return 'Active';
}

/** What the member's Home screen shows, worked out from the dates so it is right even if the cloud copy is a day old. */
export class MembershipSummary {
  constructor(
    readonly joinedDate: string | null,
    readonly expiryDate: string | null,
    readonly today: string,
  ) {}

  get status(): MembershipStatus {
    return statusFor(this.joinedDate, this.expiryDate, this.today);
  }

  /** Days until the plan ends; 0 once it has ended. */
  get daysLeft(): number {
    return this.expiryDate ? Math.max(0, daysBetween(this.today, this.expiryDate)) : 0;
  }

  /** How much of the current period has passed, from 0 to 1, for the progress bar. */
  get progress(): number {
    if (!this.joinedDate || !this.expiryDate) return 0;
    const total = daysBetween(this.joinedDate, this.expiryDate) + 1;
    if (total <= 0) return 1;
    const elapsed = daysBetween(this.joinedDate, this.today) + 1;
    return Math.min(1, Math.max(0, elapsed / total));
  }

  /** The Home screen tells the member to renew when the plan ends within seven days or has ended. */
  get needsRenewalNotice(): boolean {
    return this.status === 'Expiring Soon' || this.status === 'Expired';
  }
}
