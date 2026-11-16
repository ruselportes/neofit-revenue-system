import { useEffect, useState, type FormEvent } from 'react';
import type { Rate } from '../api/types';
import { ConfirmDialog, Notice } from '../components';
import { formatDate } from '../format';
import { messageOf, useApp, useAsync } from '../state';
import { CloudGate } from './CloudGate';

type PriceKey = 'monthly' | 'semi' | 'daily';

export default function RatesView() {
  const { api } = useApp();
  const loaded = useAsync(() => api.rates.list(), [api]);
  const [rows, setRows] = useState<Rate[]>([]);
  const [message, setMessage] = useState<{ kind?: 'error' | 'ok'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (loaded.data) setRows(loaded.data);
  }, [loaded.data]);

  const change = (index: number, key: PriceKey, value: string) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, [key]: value === '' ? 0 : Number(value) } : r)));

  const run = async (work: () => Promise<Rate[]>, done: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setRows(await work());
      setMessage({ kind: 'ok', text: done });
    } catch (err) {
      setMessage({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rates</h1>
          <p>NeoFit's official prices, in pesos.</p>
        </div>
      </div>

      {loaded.error && <Notice kind="error">{loaded.error}</Notice>}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <section className="card" style={{ marginTop: 12 }}>
        <div className="table-wrap">
          <table>
            <caption className="hint" style={{ textAlign: 'left', paddingBottom: 8 }}>
              One row for each plan category and treadmill option.
            </caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th className="num">Monthly</th>
                <th className="num">Semi-monthly</th>
                <th className="num">Daily</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.category}|${r.type}`}>
                  <td>{r.category}</td>
                  <td>{r.type}</td>
                  {(['monthly', 'semi', 'daily'] as PriceKey[]).map((key) => (
                    <td className="num" key={key}>
                      <input
                        className="input"
                        style={{ width: 100, textAlign: 'right' }}
                        type="number"
                        min={0}
                        step="1"
                        value={r[key]}
                        aria-label={`${r.category} ${r.type} ${key}`}
                        onChange={(e) => change(i, key, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-foot" style={{ marginTop: 14 }}>
          <button className="btn" disabled={busy} onClick={() => setConfirmReset(true)}>
            Reset Default
          </button>
          <button className="btn primary" disabled={busy} onClick={() => run(() => api.rates.save(rows), 'Rates saved.')}>
            Save Rates
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Changes apply at once to the revenue figures and to the amount filled in on the member forms.
        </p>
      </section>
      {confirmReset && (
        <ConfirmDialog
          title="Restore the official rates"
          text="Replace every price above with NeoFit's official rates? Prices you changed are lost, and revenue figures and the member forms use the official rates again."
          confirmLabel="Restore rates"
          busyLabel="Restoring…"
          onClose={() => setConfirmReset(false)}
          action={async () => {
            setRows(await api.rates.reset());
            setMessage({ kind: 'ok', text: 'Official rates restored.' });
          }}
        />
      )}
      <section aria-labelledby="news" style={{ marginTop: 24 }}>
        <h2 id="news" style={{ marginBottom: 10 }}>Announcements for members</h2>
        <CloudGate feature="Announcements">
          <Announcements />
        </CloudGate>
      </section>
    </>
  );
}

function Announcements() {
  const { api } = useApp();
  const list = useAsync(() => api.cloud.announcements(), [api]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const post = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.cloud.postAnnouncement(title, body);
      setTitle('');
      setBody('');
      list.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const [removing, setRemoving] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className="two-col">
      <div className="card">
        {list.error && <Notice kind="error">{list.error}</Notice>}
        {list.data && list.data.length === 0 && <div className="empty">No announcements yet.</div>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.data?.map((a) => (
            <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <strong>{a.title}</strong>
                <div className="hint">{formatDate(a.postedAt.slice(0, 10))}</div>
                <div>{a.body}</div>
              </div>
              <button className="btn small danger" onClick={() => setRemoving({ id: a.id, title: a.title })} aria-label={`Remove ${a.title}`}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
      <form className="card form" onSubmit={post}>
        {error && <Notice kind="error">{error}</Notice>}
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea className="input" rows={4} value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} required />
          <span className="hint">{body.length}/500</span>
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Posting…' : 'Post Announcement'}</button>
      </form>
      {removing && (
        <ConfirmDialog
          title="Remove announcement"
          text={`Remove "${removing.title}"? Members will no longer see it. This cannot be undone.`}
          confirmLabel="Remove"
          busyLabel="Removing…"
          onClose={() => setRemoving(null)}
          action={async () => {
            await api.cloud.removeAnnouncement(removing.id);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
