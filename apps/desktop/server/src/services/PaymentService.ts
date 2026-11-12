import { randomUUID } from 'node:crypto';
import { PlanParser, ValidationError, type BillingPeriod } from '@neofit/core';
import type { MemberRecord, PaymentRecord } from '../models';
import type { PaymentRepository } from '../repositories/PaymentRepository';
import type { RateRepository } from '../repositories/RateRepository';
import { addDays, addMonths } from '../util/dates';

export interface Coverage {
  start: string;
  end: string;
}

/** Records payments: fills in the amount from the rate, the period covered and the receipt number. */
export class PaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly rates: RateRepository,
  ) {}

  /** The days a payment covers: a month, half a month or one day. */
  static coverage(period: BillingPeriod, start: string): Coverage {
    switch (period) {
      case 'Monthly':
        return { start, end: addDays(addMonths(start, 1), -1) };
      case 'Semi-Monthly':
        return { start, end: addDays(start, 14) };
      case 'Daily':
        return { start, end: start };
    }
  }

  /** Receipt number YYYY-MMDD-NN, where NN counts the payments recorded that day. */
  receiptNumber(date: string): string {
    const n = this.payments.countOnDate(date) + 1;
    const [y, m, d] = date.split('-');
    return `${y}-${m}${d}-${String(n).padStart(2, '0')}`;
  }

  /** The price of a plan from the current rates; throws if the plan has no rate. */
  priceOf(planText: string): number {
    const price = this.rates.toRateBook().priceOf(PlanParser.parse(planText));
    if (!price) throw new ValidationError(`No rate for plan: ${planText}`);
    return price.pesos;
  }

  record(member: MemberRecord, planText: string, coverage: Coverage, paidAt: string, amount?: number): PaymentRecord {
    const finalAmount = amount ?? this.priceOf(planText);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) throw new ValidationError('Amount must be more than zero.');
    const payment: PaymentRecord = {
      id: randomUUID(),
      memberId: member.id,
      receiptNo: this.receiptNumber(paidAt.slice(0, 10)),
      amount: finalAmount,
      plan: planText,
      periodStart: coverage.start,
      periodEnd: coverage.end,
      paidAt,
    };
    this.payments.insert(payment);
    return payment;
  }

  listForMember(memberId: number): PaymentRecord[] {
    return this.payments.listByMember(memberId);
  }
}
