import type { MemberRecord, MemberStatus, NewMember } from '../models';
import { Repository } from './Repository';

interface MemberRow {
  id: number;
  member_id: string;
  name: string;
  contact: string;
  email: string | null;
  plan: string;
  status: MemberStatus;
  joined_date: string | null;
  expiry_date: string | null;
  address: string;
  photo: string | null;
  cloud_id: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
}

export class MemberRepository extends Repository {
  list(): MemberRecord[] {
    return (this.db.prepare('SELECT * FROM members ORDER BY id').all() as MemberRow[]).map(toRecord);
  }

  findById(id: number): MemberRecord | undefined {
    const row = this.db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined;
    return row && toRecord(row);
  }

  /** Another member who already uses this email address (capital letters do not matter). */
  findOtherByEmail(email: string, exceptId?: number): { memberId: string; name: string } | undefined {
    return this.db
      .prepare('SELECT member_id AS memberId, name FROM members WHERE lower(email) = lower(?) AND id IS NOT ? LIMIT 1')
      .get(email, exceptId ?? null) as { memberId: string; name: string } | undefined;
  }

  /** The next free ID in the form M-001. */
  nextMemberId(): string {
    const rows = this.db.prepare('SELECT member_id FROM members').all() as { member_id: string }[];
    const highest = rows.reduce((max, r) => Math.max(max, Number(/^M-(\d+)$/.exec(r.member_id)?.[1] ?? 0)), 0);
    return `M-${String(highest + 1).padStart(3, '0')}`;
  }

  insert(m: NewMember): MemberRecord {
    const result = this.db
      .prepare(
        `INSERT INTO members (member_id, name, contact, email, plan, status, joined_date, expiry_date, address, photo)
         VALUES (@memberId, @name, @contact, @email, @plan, @status, @joinedDate, @expiryDate, @address, @photo)`,
      )
      .run(m);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, m: Omit<NewMember, 'memberId'>): void {
    this.db
      .prepare(
        `UPDATE members SET name=@name, contact=@contact, email=@email, plan=@plan, status=@status,
           joined_date=@joinedDate, expiry_date=@expiryDate, address=@address, photo=@photo,
           updated_at=datetime('now','localtime') WHERE id=@id`,
      )
      .run({ ...m, id });
  }

  setStatus(id: number, status: MemberStatus): void {
    this.db.prepare('UPDATE members SET status = ? WHERE id = ?').run(status, id);
  }

  setCloudId(id: number, cloudId: string): void {
    this.db.prepare('UPDATE members SET cloud_id = ? WHERE id = ?').run(cloudId, id);
  }

  setInvited(id: number, cloudId: string, invitedAt: string): void {
    this.db.prepare('UPDATE members SET cloud_id = ?, invited_at = ? WHERE id = ?').run(cloudId, invitedAt, id);
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM members WHERE id = ?').run(id).changes > 0;
  }
}

function toRecord(r: MemberRow): MemberRecord {
  return {
    id: r.id,
    memberId: r.member_id,
    name: r.name,
    contact: r.contact,
    email: r.email,
    plan: r.plan,
    status: r.status,
    joinedDate: r.joined_date,
    expiryDate: r.expiry_date,
    address: r.address,
    photo: r.photo,
    cloudId: r.cloud_id,
    invitedAt: r.invited_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
