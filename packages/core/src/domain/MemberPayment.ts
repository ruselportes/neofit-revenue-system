import { ValidationError } from '../errors';
import type { Money } from './Money';
import type { Plan } from './Plan';

/** A payment recorded on the desktop at the front desk. */
export class MemberPayment {
  constructor(
    readonly id: string,
    readonly memberName: string,
    readonly amount: Money,
    /** Payment date, YYYY-MM-DD. */
    readonly date: string,
    readonly plan: Plan,
  ) {
    if (!id) throw new ValidationError('Payment id is required.');
    if (memberName.trim().length === 0) throw new ValidationError('Member name is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError(`Invalid payment date: ${date}`);
  }
}
