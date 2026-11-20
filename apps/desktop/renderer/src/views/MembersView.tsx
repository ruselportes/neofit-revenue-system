import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Member, MemberStatus, Payment, Rate } from '../api/types';
import { Modal, Notice, StatusBadge } from '../components';
import { formatDate, formatPeso, todayText } from '../format';
import { CATEGORIES, PERIODS, TREADMILL, parsePlan, planText, priceOf, type PlanChoice } from '../plan';
import { messageOf, useApp, useAsync } from '../state';
import { cleanContact, cleanName, contactProblem, nameProblem } from '../validation';

const STATUSES: Array<MemberStatus | 'All'> = ['All', 'Active', 'Expiring Soon', 'Expired', 'Pending'];
const MAX_PHOTO_BYTES = 1_500_000;

type Dialog =
  | { kind: 'form'; member?: Member }
  | { kind: 'details'; member: Member }
  | { kind: 'renew'; member: Member }
  | { kind: 'delete'; member: Member };

export default function MembersView({ autoOpenForm }: { autoOpenForm: boolean }) {
  const { api } = useApp();
  const members = useAsync(() => api.members.list(), [api]);
  const rates = useAsync(() => api.rates.list(), [api]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<MemberStatus | 'All'>('All');
  const [dialog, setDialog] = useState<Dialog | null>(autoOpenForm ? { kind: 'form' } : null);
  const [notice, setNotice] = useState<string>();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members.data ?? []).filter(
      (m) => (status === 'All' || m.status === status) && (!q || m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q)),
    );
  }, [members.data, query, status]);

  const close = () => setDialog(null);
  const saved = (text: string) => {
    setNotice(text);
    close();
    members.reload();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p>{members.data ? `${members.data.length} members` : 'Loading…'}</p>
        </div>
        <button className="btn primary" onClick={() => setDialog({ kind: 'form' })}>
          Add New Member
        </button>
      </div>

      {notice && <Notice kind="ok">{notice}</Notice>}
      {members.error && <Notice kind="error">{members.error}</Notice>}

      <div className="toolbar" style={{ marginTop: 12 }}>
        <input className="input" type="search" placeholder="Search by name or ID" aria-label="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" style={{ maxWidth: 180 }} aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as MemberStatus | 'All')}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td>{m.memberId}</td>
                  <td className="nowrap">{m.name}</td>
                  <td>{m.plan}</td>
                  <td className="nowrap">{formatDate(m.expiryDate)}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn small" onClick={() => setDialog({ kind: 'details', member: m })}>Details</button>
                      <button className="btn small" onClick={() => setDialog({ kind: 'form', member: m })}>Edit</button>
                      <button className="btn small danger" onClick={() => setDialog({ kind: 'delete', member: m })}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.data && shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    {members.data.length === 0 ? 'No members yet. Add the first one.' : 'No members match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialog?.kind === 'form' && <MemberForm member={dialog.member} rates={rates.data ?? []} onClose={close} onSaved={saved} />}
      {dialog?.kind === 'details' && (
        <MemberDetails
          member={dialog.member}
          onClose={close}
          onEdit={() => setDialog({ kind: 'form', member: dialog.member })}
          onRenew={() => setDialog({ kind: 'renew', member: dialog.member })}
          onInvited={members.reload}
        />
      )}
      {dialog?.kind === 'renew' && <RenewDialog member={dialog.member} rates={rates.data ?? []} onClose={close} onSaved={saved} />}
      {dialog?.kind === 'delete' && <DeleteDialog member={dialog.member} onClose={close} onSaved={saved} />}
    </>
  );
}

function PlanPicker({ value, onChange }: { value: PlanChoice; onChange: (p: PlanChoice) => void }) {
  return (
    <div className="grid-3">
      <label className="field">
        <span>Category</span>
        <select className="input" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as PlanChoice['category'] })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Period</span>
        <select className="input" value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value as PlanChoice['period'] })}>
          {PERIODS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Treadmill</span>
        <select className="input" value={value.treadmill} onChange={(e) => onChange({ ...value, treadmill: e.target.value as PlanChoice['treadmill'] })}>
          {TREADMILL.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
    </div>
  );
}

function MemberForm({ member, rates, onClose, onSaved }: { member?: Member; rates: Rate[]; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useApp();
  const editing = member !== undefined;
  const [name, setName] = useState(member?.name ?? '');
  const [contact, setContact] = useState(member?.contact ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [address, setAddress] = useState(member?.address ?? '');
  const [photo, setPhoto] = useState<string | null>(member?.photo ?? null);
  const [plan, setPlan] = useState<PlanChoice>(parsePlan(member?.plan ?? ''));
  const [joined, setJoined] = useState(member?.joinedDate ?? todayText());
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const price = priceOf(plan, rates);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    if (file.size > MAX_PHOTO_BYTES) return setError('The photo is too large (maximum 1.5 MB).');
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const cleanedName = name.trim().replace(/\s+/g, ' ');
    const problem = nameProblem(cleanedName) ?? contactProblem(contact);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const common = { name: cleanedName, contact: contact.trim(), email, address, plan: planText(plan), ...(photo ? { photo } : {}) };
      if (editing) {
        await api.members.update(member.id, { ...common, joinedDate: joined });
        onSaved(`${name} was updated.`);
      } else {
        const result = await api.members.create({
          ...common,
          joinedDate: joined,
          ...(amount !== '' ? { amount: Number(amount) } : {}),
        });
        onSaved(`${name} was added as ${result.member.memberId}. Receipt ${result.payment.receiptNo}.`);
      }
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${member.name}` : 'Add New Member'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="grid-2">
          <label className="field">
            <span>Full name</span>
            <input className="input" value={name} onChange={(e) => setName(cleanName(e.target.value))} maxLength={100} autoComplete="off" required autoFocus />
          </label>
          <label className="field">
            <span>Contact number</span>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="0917 123 4567"
              value={contact}
              onChange={(e) => setContact(cleanContact(e.target.value))}
              maxLength={20}
              autoComplete="off"
              required
            />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Email (for the member app, optional)</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field"><span>Address</span><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        </div>
        <PlanPicker value={plan} onChange={setPlan} />
        <div className="grid-2">
          <label className="field"><span>{editing ? 'Joined date' : 'Start date'}</span><input className="input" type="date" value={joined} onChange={(e) => setJoined(e.target.value)} required /></label>
          {!editing && (
            <label className="field">
              <span>Amount paid</span>
              <input className="input" type="number" min={1} step="1" value={amount} placeholder={price !== undefined ? String(price) : ''} onChange={(e) => setAmount(e.target.value)} />
              <span className="hint">{price !== undefined ? `Rate for this plan: ${formatPeso(price)}. Leave empty to use it.` : 'No rate found for this plan.'}</span>
            </label>
          )}
        </div>
        <div className="field">
          <span>Photo (optional)</span>
          <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          {photo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <img className="avatar" src={photo} alt="Member" />
              <button type="button" className="btn small" onClick={() => setPhoto(null)}>Remove photo</button>
            </div>
          )}
        </div>
        {editing && <p className="hint">The plan and dates change here only as a correction. Use Renew to record a new payment.</p>}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add member'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Shows whether the member can use the member app, and sends the invite (a sign-in code by email). */
function InviteSection({ member: initial, onInvited }: { member: Member; onInvited: () => void }) {
  const { api } = useApp();
  const cloud = useAsync(() => api.cloud.status(), [api]);
  const [member, setMember] = useState(initial);
  const [email, setEmail] = useState(initial.email ?? '');
  const [result, setResult] = useState<{ kind?: 'error' | 'ok'; text: string }>();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setResult(undefined);
    try {
      const sent = await api.cloud.invite(member.id, email.trim() || undefined);
      setMember(sent.member);
      setResult({ kind: 'ok', text: sent.status === 'resent' ? `A new sign-in code was sent to ${sent.member.email}.` : `An invite was sent to ${sent.member.email}: a sign-in code is in their email.` });
      onInvited();
    } catch (err) {
      setResult({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <dl className="dl">
        <dt>Status</dt>
        <dd>{member.invitedAt ? `Invited on ${formatDate(member.invitedAt.slice(0, 10))}` : 'Not invited yet'}</dd>
      </dl>
      {cloud.data?.configured ? (
        <div className="form" style={{ marginTop: 8 }}>
          <label className="field">
            <span>Email address</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
          </label>
          <p className="hint" style={{ margin: 0 }}>
            The member gets an email with a sign-in code. They install the NeoFit app, choose Member sign in, enter this email address,
            tap "I already have a code" and type the code from the email. They will see their plan, payments, receipts, rates and
            announcements, and can only view them: renewals are paid at the front desk.
          </p>
          {result && <Notice kind={result.kind}>{result.text}</Notice>}
          <button className="btn small" style={{ alignSelf: 'flex-start' }} disabled={busy || !email.trim()} onClick={send}>
            {busy ? 'Sending…' : member.invitedAt ? 'Send a new code' : 'Send Invite'}
          </button>
        </div>
      ) : (
        <>
          <p className="hint">Sending an invite needs the cloud connection, which is not set up on this computer yet.</p>
          <button className="btn small" disabled>Send Invite</button>
        </>
      )}
    </>
  );
}

function MemberDetails({ member, onClose, onEdit, onRenew, onInvited }: { member: Member; onClose: () => void; onEdit: () => void; onRenew: () => void; onInvited: () => void }) {
  const { api } = useApp();
  const payments = useAsync<Payment[]>(() => api.members.payments(member.id), [api, member.id]);
  const last = payments.data?.[0];

  return (
    <Modal
      title="Member details"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn primary" onClick={onRenew}>Renew</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {member.photo ? <img className="avatar" src={member.photo} alt={member.name} /> : <div className="avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>}
        <div>
          <h2>{member.name}</h2>
          <span className="hint">{member.memberId}</span>
        </div>
      </div>
      <dl className="dl">
        <dt>Plan</dt><dd>{member.plan}</dd>
        <dt>Status</dt><dd><StatusBadge status={member.status} /></dd>
        <dt>Joined</dt><dd>{formatDate(member.joinedDate)}</dd>
        <dt>Plan expires</dt><dd>{formatDate(member.expiryDate)}</dd>
        <dt>Contact</dt><dd>{member.contact}</dd>
        <dt>Address</dt><dd>{member.address || '—'}</dd>
        <dt>Last payment</dt>
        <dd>{last ? `${formatPeso(last.amount)} on ${formatDate(last.paidAt.slice(0, 10))} (receipt ${last.receiptNo})` : '—'}</dd>
      </dl>

      <section aria-labelledby="access">
        <h2 id="access" style={{ marginBottom: 6 }}>Member app access</h2>
        <InviteSection member={member} onInvited={onInvited} />
      </section>

      <section aria-labelledby="history">
        <h2 id="history" style={{ marginBottom: 6 }}>Payment history</h2>
        {payments.error && <Notice kind="error">{payments.error}</Notice>}
        {payments.data && payments.data.length === 0 && <div className="empty">No payments.</div>}
        {payments.data && payments.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Receipt</th><th>Paid</th><th>Covers</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {payments.data.map((p) => (
                  <tr key={p.id}>
                    <td>{p.receiptNo}</td>
                    <td>{formatDate(p.paidAt.slice(0, 10))}</td>
                    <td>{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</td>
                    <td className="num">{formatPeso(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Modal>
  );
}

function RenewDialog({ member, rates, onClose, onSaved }: { member: Member; rates: Rate[]; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useApp();
  const [plan, setPlan] = useState<PlanChoice>(parsePlan(member.plan));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const price = priceOf(plan, rates);

  useEffect(() => setAmount(''), [plan]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { payment, member: renewed } = await api.members.renew(member.id, {
        plan: planText(plan),
        ...(amount !== '' ? { amount: Number(amount) } : {}),
      });
      onSaved(`${member.name} renewed until ${formatDate(renewed.expiryDate)}. Receipt ${payment.receiptNo}.`);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Renew ${member.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && <Notice kind="error">{error}</Notice>}
        <p className="hint" style={{ margin: 0 }}>Current plan ends {formatDate(member.expiryDate)}. The new period starts the day after, or today if it has already ended.</p>
        <PlanPicker value={plan} onChange={setPlan} />
        <label className="field">
          <span>Amount paid</span>
          <input className="input" type="number" min={1} step="1" value={amount} placeholder={price !== undefined ? String(price) : ''} onChange={(e) => setAmount(e.target.value)} />
          <span className="hint">{price !== undefined ? `Rate for this plan: ${formatPeso(price)}. Leave empty to use it.` : 'No rate found for this plan.'}</span>
        </label>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Record renewal'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useApp();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await api.members.remove(member.id);
      onSaved(`${member.name} was deleted.`);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Delete member"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={busy} onClick={confirm}>{busy ? 'Deleting…' : 'Delete'}</button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      <p style={{ margin: 0 }}>
        Delete <strong>{member.name}</strong> ({member.memberId}) and all of their payment records? This cannot be undone.
      </p>
    </Modal>
  );
}
