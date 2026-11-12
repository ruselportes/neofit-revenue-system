import type { OutboxChange, OutboxItem, SyncOutbox, PublishSummary } from './SyncOutbox';

/** Tells whether a member has been invited to the member app. */
export interface IInvitedMembers {
  isInvited(memberId: string): Promise<boolean>;
}

export interface MemberChange extends OutboxChange {
  /** The member this change belongs to. Required for 'member' and 'payment'; rates have none. */
  readonly memberId?: string;
}

/**
 * Facade over the outbox for the desktop routes. Members who were never invited are never
 * copied to the cloud, so changes about them are dropped; rate changes always go out.
 * To remove an invited member from the cloud, queue the delete before deleting them locally.
 */
export class MemberSync {
  constructor(
    private readonly outbox: SyncOutbox,
    private readonly invited: IInvitedMembers,
  ) {}

  /** Returns the queued item, or null when the change is not for the cloud. */
  async queueChange(change: MemberChange): Promise<OutboxItem | null> {
    if (change.entity !== 'rate') {
      if (!change.memberId || !(await this.invited.isInvited(change.memberId))) return null;
    }
    const { memberId: _memberId, ...outboxChange } = change;
    return this.outbox.queueChange(outboxChange);
  }

  /** Call after every change and every five minutes. */
  publishPending(): Promise<PublishSummary> {
    return this.outbox.publishPending();
  }
}
