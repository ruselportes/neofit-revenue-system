import { statusFor } from '@neofit/core';
import type { MemberStatus } from '../models';

/** Table 23.0: how a member's status follows from the dates. The rule lives in the core, shared with the member app. */
export class MemberStatusPolicy {
  static statusFor(joinedDate: string | null, expiryDate: string | null, today: string): MemberStatus {
    return statusFor(joinedDate, expiryDate, today);
  }
}
