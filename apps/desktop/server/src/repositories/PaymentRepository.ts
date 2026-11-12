import type { PaymentRecord, PaymentWithMember } from '../models';
import { Repository } from './Repository';

interface PaymentRow {
  id: string;
  member_id: number;
  receipt_no: string;
  amount: number;
  plan: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string;
  member_name?: string;
}

export class PaymentRepository extends Repository {
  insert(p: PaymentRecord): void {
    this.db
      .prepare(
        `INSERT INTO member_payments (id, member_id, receipt_no, amount, plan, period_start, period_end, paid_at)
         VALUES (@id, @memberId, @receiptNo, @amount, @plan, @periodStart, @periodEnd, @paidAt)`,
      )
      .run(p);
  }

  findById(id: string): PaymentRecord | undefined {
    const row = this.db.prepare('SELECT * FROM member_payments WHERE id = ?').get(id) as PaymentRow | undefined;
    return row && toRecord(row);
  }

  /** How many payments were recorded on a date (YYYY-MM-DD); used for the receipt number. */
  countOnDate(date: string): number {
    return (
      this.db.prepare('SELECT COUNT(*) AS n FROM member_payments WHERE substr(paid_at, 1, 10) = ?').get(date) as {
        n: number;
      }
    ).n;
  }

  listByMember(memberId: number): PaymentRecord[] {
    return (
      this.db.prepare('SELECT * FROM member_payments WHERE member_id = ? ORDER BY paid_at DESC, receipt_no DESC').all(
        memberId,
      ) as PaymentRow[]
    ).map(toRecord);
  }

  /** Payments recorded between two dates, inclusive, with the member's name. */
  inRange(start: string, end: string): PaymentWithMember[] {
    const rows = this.db
      .prepare(
        `SELECT p.*, m.name AS member_name FROM member_payments p JOIN members m ON m.id = p.member_id
         WHERE substr(p.paid_at, 1, 10) BETWEEN ? AND ? ORDER BY p.paid_at`,
      )
      .all(start, end) as PaymentRow[];
    return rows.map((r) => ({ ...toRecord(r), memberName: r.member_name ?? '' }));
  }
}

function toRecord(r: PaymentRow): PaymentRecord {
  return {
    id: r.id,
    memberId: r.member_id,
    receiptNo: r.receipt_no,
    amount: r.amount,
    plan: r.plan,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    paidAt: r.paid_at,
  };
}
