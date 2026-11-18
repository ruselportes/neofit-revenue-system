import { useState, type FormEvent } from 'react';
import type { DayTotal, LogbookRow } from '../api/types';
import { ConfirmDialog, Modal, Notice } from '../components';
import { formatDate, formatPeso, monthName, shiftMonth, todayText } from '../format';
import { messageOf, useApp, useAsync } from '../state';
import { isFutureMonth } from '../validation';
import { CloudGate } from './CloudGate';

export default function LogbookView() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Logbook</h1>
          <p>Entries synchronized from the mobile app. You can correct them or add a page that was not scanned.</p>
        </div>
      </div>
      <CloudGate feature="The logbook">
        <LogbookBody />
      </CloudGate>
    </>
  );
}

type Dialog = { kind: 'edit'; row: LogbookRow } | { kind: 'add' } | { kind: 'delete-entry'; row: LogbookRow } | { kind: 'delete-day' };

function LogbookBody() {
  const { api } = useApp();
  const [date, setDate] = useState(todayText());
  const [month, setMonth] = useState(() => {
    const [y, m] = todayText().split('-').map(Number);
    return { year: y!, month: m! };
  });
  const day = useAsync(() => api.cloud.logbookDay(date), [api, date]);
  const totals = useAsync(() => api.cloud.logbookTotals(month.year, month.month), [api, month.year, month.month]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string>();

  const changed = (text: string) => {
    setNotice(text);
    setDialog(null);
    day.reload();
    totals.reload();
  };

  const today = todayText();
  const nextMonth = shiftMonth(month.year, month.month, 1);
  const atCurrentMonth = isFutureMonth(nextMonth.year, nextMonth.month);

  const pick = (value: string) => {
    if (!value || value > today) return; // the logbook only has days that have happened
    setDate(value);
    const [y, m] = value.split('-').map(Number);
    if (y !== month.year || m !== month.month) setMonth({ year: y!, month: m! });
  };

  return (
    <>
      {notice && <Notice kind="ok">{notice}</Notice>}
      <div className="two-col" style={{ marginTop: 12 }}>
        <section className="card" aria-label="Calendar">
          <div className="page-head" style={{ marginBottom: 10 }}>
            <div className="month-nav">
              <button className="btn small" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month.year, month.month, -1))}>‹</button>
              <strong aria-live="polite">{monthName(month.year, month.month)}</strong>
              <button
                className="btn small"
                aria-label="Next month"
                title={atCurrentMonth ? 'This is the current month' : undefined}
                disabled={atCurrentMonth}
                onClick={() => setMonth(nextMonth)}
              >
                ›
              </button>
            </div>
            <input className="input" style={{ maxWidth: 160 }} type="date" aria-label="Date" value={date} max={today} onChange={(e) => pick(e.target.value)} />
          </div>
          {totals.error && <Notice kind="error">{totals.error}</Notice>}
          <Calendar year={month.year} month={month.month} selected={date} totals={totals.data ?? []} onPick={setDate} />
        </section>

        <section className="card" aria-label="Entries">
          <div className="page-head" style={{ marginBottom: 10 }}>
            <div>
              <h2>{formatDate(date)}</h2>
              <span className="hint">{day.data ? `${day.data.count} entries · ${formatPeso(day.data.total)}` : 'Loading…'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn small primary" onClick={() => setDialog({ kind: 'add' })}>Add entries</button>
              <button className="btn small danger" disabled={!day.data?.count} onClick={() => setDialog({ kind: 'delete-day' })}>Delete all</button>
            </div>
          </div>
          {day.error && <Notice kind="error">{day.error}</Notice>}
          {day.data && day.data.entries.length === 0 && <div className="empty">No entries on this date.</div>}
          {day.data && day.data.entries.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th className="num">Amount</th><th>Source</th><th>Time</th><th /></tr>
                </thead>
                <tbody>
                  {day.data.entries.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="num">{r.amount === null ? '—' : formatPeso(r.amount)}</td>
                      <td>{r.source === 'scan' ? 'Scanned' : 'Added by hand'}</td>
                      <td className="nowrap">{timeOf(r.createdAt)}</td>
                      <td>
                        <div className="actions">
                          <button className="btn small" onClick={() => setDialog({ kind: 'edit', row: r })}>Edit</button>
                          <button className="btn small danger" onClick={() => setDialog({ kind: 'delete-entry', row: r })}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {dialog?.kind === 'edit' && <EditEntry row={dialog.row} onClose={() => setDialog(null)} onSaved={changed} />}
      {dialog?.kind === 'add' && <AddEntries date={date} onClose={() => setDialog(null)} onSaved={changed} />}
      {dialog?.kind === 'delete-entry' && (
        <ConfirmDialog
          title="Delete entry"
          text={`Delete ${dialog.row.name}${dialog.row.amount === null ? '' : ` (${formatPeso(dialog.row.amount)})`} from the logbook?`}
          onClose={() => setDialog(null)}
          action={async () => {
            await api.cloud.deleteLogbookEntry(dialog.row.id);
            changed('Entry deleted.');
          }}
        />
      )}
      {dialog?.kind === 'delete-day' && (
        <ConfirmDialog
          title="Delete all entries"
          text={`Delete all ${day.data?.count ?? 0} entries of ${formatDate(date)}? The revenue of that day will drop by ${formatPeso(day.data?.total ?? 0)}. This cannot be undone.`}
          onClose={() => setDialog(null)}
          action={async () => {
            await api.cloud.deleteLogbookDate(date);
            changed(`All entries of ${formatDate(date)} were deleted.`);
          }}
        />
      )}
    </>
  );
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/** Month grid that shows the total of every day that has entries. Sunday is the first column. */
function Calendar({ year, month, selected, totals, onPick }: { year: number; month: number; selected: string; totals: DayTotal[]; onPick: (d: string) => void }) {
  const byDate = new Map(totals.map((t) => [t.date, t]));
  const lead = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = todayText();

  return (
    <div role="grid" aria-label={monthName(year, month)} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
        <div key={d} className="hint" style={{ textAlign: 'center', fontWeight: 600 }}>{d}</div>
      ))}
      {cells.map((n, i) => {
        if (n === null) return <div key={`b${i}`} />;
        const text = `${year}-${String(month).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
        const t = byDate.get(text);
        const isSelected = text === selected;
        return (
          <button
            key={text}
            role="gridcell"
            aria-selected={isSelected}
            aria-label={`${formatDate(text)}${t ? `, ${t.count} entries, ${formatPeso(t.total)}` : ', no entries'}`}
            onClick={() => onPick(text)}
            disabled={text > today}
            style={{
              opacity: text > today ? 0.4 : 1,
              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
              background: isSelected ? 'var(--primary-soft)' : t ? 'var(--surface-2)' : 'var(--surface)',
              borderRadius: 8,
              padding: '6px 2px',
              cursor: text > today ? 'not-allowed' : 'pointer',
              minHeight: 52,
              outline: text === today ? '1px dashed var(--muted)' : undefined,
            }}
          >
            <div style={{ fontWeight: 600 }}>{n}</div>
            <div className="hint" style={{ fontSize: 11 }}>{t ? formatPeso(t.total).replace('.00', '') : ''}</div>
          </button>
        );
      })}
    </div>
  );
}

function EditEntry({ row, onClose, onSaved }: { row: LogbookRow; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useApp();
  const [name, setName] = useState(row.name);
  const [amount, setAmount] = useState(row.amount === null ? '' : String(row.amount));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.cloud.updateLogbookEntry(row.id, { name, ...(amount !== '' ? { amount: Number(amount) } : {}) });
      onSaved('Entry updated.');
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit entry" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && <Notice kind="error">{error}</Notice>}
        <label className="field"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></label>
        <label className="field">
          <span>Amount (pesos)</span>
          <input className="input" type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="hint">Leave empty for a name without an amount.</span>
        </label>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

interface Draft {
  key: number;
  name: string;
  amount: string;
}

function AddEntries({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: (text: string) => void }) {
  const { api } = useApp();
  const [rows, setRows] = useState<Draft[]>([{ key: 1, name: '', amount: '' }]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = (key: number, change: Partial<Draft>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...change } : x)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((r) => r.name.trim() !== '');
    if (filled.length === 0) return setError('Enter at least one name.');
    setBusy(true);
    setError(undefined);
    try {
      await api.cloud.addLogbookEntries(date, filled.map((r) => ({ name: r.name, ...(r.amount !== '' ? { amount: Number(r.amount) } : {}) })));
      onSaved(`${filled.length} ${filled.length === 1 ? 'entry was' : 'entries were'} added to ${formatDate(date)}.`);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Add entries to ${formatDate(date)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && <Notice kind="error">{error}</Notice>}
        {rows.map((r, i) => (
          <div className="grid-2" key={r.key} style={{ gridTemplateColumns: '2fr 1fr auto', alignItems: 'end' }}>
            <label className="field"><span>Name</span><input className="input" value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} autoFocus={i === 0} /></label>
            <label className="field"><span>Amount</span><input className="input" type="number" min={0} step="1" value={r.amount} onChange={(e) => set(r.key, { amount: e.target.value })} /></label>
            <button type="button" className="btn small" aria-label={`Remove row ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setRows((x) => [...x, { key: Math.max(...x.map((y) => y.key)) + 1, name: '', amount: '' }])}>
          + Add another
        </button>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Add entries'}</button>
        </div>
      </form>
    </Modal>
  );
}

