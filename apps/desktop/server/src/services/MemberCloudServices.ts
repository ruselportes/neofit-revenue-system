import { randomUUID } from 'node:crypto';
import type { ICloudPublisher, OutboxItem } from '@neofit/core';
import { ValidationError } from '@neofit/core';
import type { Announcement, ICloudAnnouncements, ICloudMembers, MemberAccountRow, MemberPaymentRow } from '../cloud/ports';
import type { MemberRecord, PaymentRecord } from '../models';
import type { MemberRepository } from '../repositories/MemberRepository';
import type { PaymentRepository } from '../repositories/PaymentRepository';
import type { RateRepository } from '../repositories/RateRepository';
import { Body } from '../util/validate';
import type { MemberService } from './MemberService';

const accountRow = (m: MemberRecord, cloudId: string): MemberAccountRow => ({
  id: cloudId,
  memberId: m.memberId,
  name: m.name,
  email: m.email ?? '',
  plan: m.plan,
  status: m.status,
  joinedDate: m.joinedDate,
  expiryDate: m.expiryDate,
});

const paymentRow = (p: PaymentRecord, accountId: string): MemberPaymentRow => ({
  id: p.id,
  accountId,
  receiptNo: p.receiptNo,
  amount: p.amount,
  plan: p.plan,
  periodStart: p.periodStart,
  periodEnd: p.periodEnd,
  // SQLite keeps the computer's local time without a zone; this turns it into an exact moment.
  paidAt: new Date(p.paidAt.replace(' ', 'T')).toISOString(),
});

/**
 * Sends one outbox item to the cloud. It reads the current record at the time of sending,
 * so the cloud always gets the latest copy, and an item for a record that no longer exists is
 * simply done. Every operation is an upsert or a delete, so sending an item twice is harmless.
 */
export class CloudPublisher implements ICloudPublisher {
  constructor(
    private readonly cloud: ICloudMembers,
    private readonly members: MemberRepository,
    private readonly payments: PaymentRepository,
    private readonly rates: RateRepository,
  ) {}

  async publish(item: OutboxItem): Promise<void> {
    switch (item.entity) {
      case 'member': {
        if (item.operation === 'delete') return this.cloud.removeAccount(item.entityId);
        const member = this.members.findById(Number(item.entityId));
        if (member?.cloudId && member.email) await this.cloud.upsertAccount(accountRow(member, member.cloudId));
        return;
      }
      case 'payment': {
        const payment = this.payments.findById(item.entityId);
        const member = payment && this.members.findById(payment.memberId);
        if (payment && member?.cloudId) await this.cloud.upsertPayment(paymentRow(payment, member.cloudId));
        return;
      }
      case 'rate':
        return this.cloud.upsertRates(this.rates.all());
    }
  }
}

/** Invites a member to the member app (SDD Section 4.11). */
export class MemberAccessService {
  constructor(
    private readonly cloud: ICloudMembers,
    private readonly members: MemberRepository,
    private readonly payments: PaymentRepository,
    private readonly memberService: MemberService,
  ) {}

  /**
   * Publishes the member and the payments at once, then asks the cloud to invite the email address.
   * Inviting again sends a new sign-in code instead of creating a second account.
   */
  async invite(id: number, raw: unknown): Promise<{ member: MemberRecord; status: 'invited' | 'resent' }> {
    const email = new Body(raw ?? {}).optionalEmail('email');
    if (email) await this.memberService.update(id, { email });

    const member = this.memberService.get(id);
    if (!member.email) throw new ValidationError("Add the member's email address first.");

    const cloudId = member.cloudId ?? randomUUID();
    await this.cloud.upsertAccount(accountRow(member, cloudId));
    if (!member.cloudId) this.members.setCloudId(id, cloudId);
    for (const payment of this.payments.listByMember(id).reverse()) {
      await this.cloud.upsertPayment(paymentRow(payment, cloudId));
    }

    const result = await this.cloud.invite(cloudId);
    this.members.setInvited(id, cloudId, result.invitedAt);
    return { member: this.memberService.get(id), status: result.status };
  }
}

export class AnnouncementService {
  constructor(private readonly cloud: ICloudAnnouncements) {}

  list(): Promise<Announcement[]> {
    return this.cloud.list();
  }

  post(raw: unknown): Promise<Announcement> {
    const body = new Body(raw);
    return this.cloud.post(body.string('title', 80), body.string('body', 500));
  }

  remove(id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError('Invalid id.');
    return this.cloud.remove(id);
  }
}
