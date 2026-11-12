import { PlanParser, type IClock } from '@neofit/core';
import { NotFoundError } from '../errors';
import type { MemberRecord, PaymentRecord } from '../models';
import type { MemberRepository } from '../repositories/MemberRepository';
import type { AppDatabase } from '../database/AppDatabase';
import { addDays, formatDate, formatDateTime } from '../util/dates';
import { Body } from '../util/validate';
import type { CloudSyncCoordinator } from './CloudSyncCoordinator';
import { MemberStatusPolicy } from './MemberStatusPolicy';
import { PaymentService } from './PaymentService';

export interface MemberSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  pending: number;
}

/** Adding, editing, renewing and deleting members (SDD Section 4.7). */
export class MemberService {
  constructor(
    private readonly database: AppDatabase,
    private readonly members: MemberRepository,
    private readonly payments: PaymentService,
    private readonly cloud: CloudSyncCoordinator,
    private readonly clock: IClock,
  ) {}

  /** Lists the members; their status is brought up to date first. */
  list(): MemberRecord[] {
    const today = this.today();
    return this.members.list().map((m) => this.refreshStatus(m, today));
  }

  get(id: number): MemberRecord {
    const member = this.members.findById(id);
    if (!member) throw new NotFoundError('Member not found.');
    return this.refreshStatus(member, this.today());
  }

  summary(): MemberSummary {
    const all = this.list();
    const count = (s: MemberRecord['status']) => all.filter((m) => m.status === s).length;
    return {
      total: all.length,
      active: count('Active'),
      expiringSoon: count('Expiring Soon'),
      expired: count('Expired'),
      pending: count('Pending'),
    };
  }

  paymentsOf(id: number): PaymentRecord[] {
    this.get(id);
    return this.payments.listForMember(id);
  }

  /** Adds a member and records the first payment, together or not at all. */
  async create(raw: unknown): Promise<{ member: MemberRecord; payment: PaymentRecord }> {
    const body = new Body(raw);
    const plan = PlanParser.parse(body.string('plan', 60)).toString();
    const planParsed = PlanParser.parse(plan);
    const start = body.optionalDate('joinedDate') ?? this.today();
    const coverage = PaymentService.coverage(planParsed.period, start);
    const amount = body.optionalNumber('amount');
    const paidAt = formatDateTime(this.clock.now());

    const { member, payment } = this.database.transaction(() => {
      const created = this.members.insert({
        memberId: this.members.nextMemberId(),
        name: body.string('name', 100),
        contact: body.string('contact', 20),
        email: body.optionalEmail('email') ?? null,
        plan,
        status: MemberStatusPolicy.statusFor(start, coverage.end, this.today()),
        joinedDate: start,
        expiryDate: coverage.end,
        address: body.optionalString('address', 150) ?? '',
        photo: body.optionalString('photo', 2_800_000) ?? null,
      });
      return { member: created, payment: this.payments.record(created, plan, coverage, paidAt, amount) };
    });

    await this.queueMember(member);
    await this.queuePayment(member, payment);
    return { member, payment };
  }

  /** Edits a member's details. Dates and plan change only through renewal, unless sent explicitly. */
  async update(id: number, raw: unknown): Promise<MemberRecord> {
    const current = this.get(id);
    const body = new Body(raw);
    const plan = body.has('plan') ? PlanParser.parse(body.string('plan', 60)).toString() : current.plan;
    const joinedDate = body.optionalDate('joinedDate') ?? current.joinedDate;
    const expiryDate = body.optionalDate('expiryDate') ?? current.expiryDate;

    this.members.update(id, {
      name: body.has('name') ? body.string('name', 100) : current.name,
      contact: body.has('contact') ? body.string('contact', 20) : current.contact,
      email: body.has('email') ? (body.optionalEmail('email') ?? null) : current.email,
      plan,
      status: MemberStatusPolicy.statusFor(joinedDate, expiryDate, this.today()),
      joinedDate,
      expiryDate,
      address: body.optionalString('address', 150) ?? current.address,
      photo: body.has('photo') ? (body.optionalString('photo', 2_800_000) ?? null) : current.photo,
    });
    const updated = this.get(id);
    await this.queueMember(updated);
    return updated;
  }

  /**
   * Renews a member. The new period starts the day after the current one ends,
   * or today if the plan has already expired.
   */
  async renew(id: number, raw: unknown): Promise<{ member: MemberRecord; payment: PaymentRecord }> {
    const current = this.get(id);
    const body = new Body(raw ?? {});
    const plan = body.has('plan') ? PlanParser.parse(body.string('plan', 60)).toString() : current.plan;
    const today = this.today();
    const start = current.expiryDate && current.expiryDate >= today ? addDays(current.expiryDate, 1) : today;
    const coverage = PaymentService.coverage(PlanParser.parse(plan).period, start);
    const paidAt = formatDateTime(this.clock.now());

    const payment = this.database.transaction(() => {
      const recorded = this.payments.record(current, plan, coverage, paidAt, body.optionalNumber('amount'));
      this.members.update(id, {
        name: current.name,
        contact: current.contact,
        email: current.email,
        plan,
        status: MemberStatusPolicy.statusFor(current.joinedDate, coverage.end, today),
        joinedDate: current.joinedDate,
        expiryDate: coverage.end,
        address: current.address,
        photo: current.photo,
      });
      return recorded;
    });
    const member = this.get(id);
    await this.queueMember(member);
    await this.queuePayment(member, payment);
    return { member, payment };
  }

  /**
   * Deletes a member and the member's payments. For an invited member the delete is queued
   * first, keyed by the cloud id, because the local record is gone afterwards.
   */
  async delete(id: number): Promise<void> {
    const member = this.get(id);
    if (member.cloudId) {
      await this.cloud.record({
        entity: 'member',
        operation: 'delete',
        entityId: member.cloudId,
        memberId: String(member.id),
        payload: undefined,
      });
    }
    this.members.delete(id);
  }

  private refreshStatus(member: MemberRecord, today: string): MemberRecord {
    const status = MemberStatusPolicy.statusFor(member.joinedDate, member.expiryDate, today);
    if (status === member.status) return member;
    this.members.setStatus(member.id, status);
    return { ...member, status };
  }

  private today(): string {
    return formatDate(this.clock.now());
  }

  private queueMember(member: MemberRecord): Promise<void> {
    return this.cloud.record({
      entity: 'member',
      operation: 'upsert',
      entityId: String(member.id),
      memberId: String(member.id),
      payload: undefined,
    });
  }

  private queuePayment(member: MemberRecord, payment: PaymentRecord): Promise<void> {
    return this.cloud.record({
      entity: 'payment',
      operation: 'upsert',
      entityId: payment.id,
      memberId: String(member.id),
      payload: undefined,
    });
  }
}
