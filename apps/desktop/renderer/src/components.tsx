import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import type { MemberStatus } from './api/types';
import { saveFile } from './download';
import { formatPeso } from './format';
import { messageOf } from './state';

/** A password box with an eye button that shows or hides what is typed. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-wrap">
      <input {...props} className="input" type={shown ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        title={shown ? 'Hide password' : 'Show password'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {shown ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          ) : (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

/**
 * Shows a recovery key once, with ways to keep it (copy, save as a file, print). `onDone` runs only after
 * the administrator ticks that the key is saved, because the key cannot be shown again.
 */
export function RecoveryKeyPanel({ recoveryKey, doneLabel, onDone }: { recoveryKey: string; doneLabel: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // the clipboard can be blocked; the key is on screen and in the saved file
    }
  };
  const download = () =>
    saveFile(
      new Blob([`NeoFit Revenue System - recovery key\r\n\r\n${recoveryKey}\r\n\r\nKeep this where only the owner can find it.\r\nIt lets you set a new administrator password if you forget it. Each key works once.\r\n`], { type: 'text/plain' }),
      'neofit-recovery-key.txt',
    );

  return (
    <>
      <div className="recovery-key" aria-label="Recovery key">{recoveryKey}</div>
      <div className="recovery-actions">
        <button type="button" className="btn small" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className="btn small" onClick={download}>Save as file</button>
        <button type="button" className="btn small" onClick={() => window.print()}>Print</button>
      </div>
      <Notice>Anyone with this key can reset the administrator password. Keep it safe. It is shown only once.</Notice>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I saved my recovery key</span>
      </label>
      <button type="button" className="btn primary" disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  return <span className={`badge ${status === 'Expiring Soon' ? 'Expiring' : status}`}>{status}</span>;
}

export function Notice({ kind, children }: { kind?: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div className={`notice ${kind ?? ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Asks before something that cannot be taken back. `action` runs when the administrator confirms; a failure is shown inside the box. */
export function ConfirmDialog({
  title,
  text,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  action,
  onClose,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  busyLabel?: string;
  action: () => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={busy} onClick={() => void run()}>{busy ? busyLabel : confirmLabel}</button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      <p style={{ margin: 0 }}>{text}</p>
    </Modal>
  );
}

export interface BarPoint {
  label: string;
  value: number;
}

/** Bar chart in plain SVG. The tallest bar is marked as the peak. */
export function BarChart({ points, title }: { points: BarPoint[]; title: string }) {
  const width = 720;
  const height = 240;
  const pad = { top: 16, right: 8, bottom: 26, left: 52 };
  const max = Math.max(...points.map((p) => p.value), 0);
  const top = niceCeil(max);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const step = plotW / Math.max(points.length, 1);
  const peak = max > 0 ? points.findIndex((p) => p.value === max) : -1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      {ticks.map((t) => {
        const y = pad.top + plotH - (t / top) * plotH;
        return (
          <g key={t}>
            <line className="grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end">
              {compact(t)}
            </text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const h = (p.value / top) * plotH;
        const x = pad.left + i * step + step * 0.15;
        const y = pad.top + plotH - h;
        return (
          <g key={p.label}>
            <rect className={`bar ${i === peak ? 'peak' : ''}`} x={x} y={y} width={step * 0.7} height={Math.max(h, 0)} rx={2}>
              <title>{`${p.label}: ${formatPeso(p.value)}`}</title>
            </rect>
            {(points.length <= 16 || i % 2 === 0) && (
              <text x={x + step * 0.35} y={height - 8} textAnchor="middle">
                {p.label}
              </text>
            )}
          </g>
        );
      })}
      {peak >= 0 && (
        <text
          x={pad.left + peak * step + step * 0.5}
          y={Math.max(pad.top + plotH - (max / top) * plotH - 5, 10)}
          textAnchor="middle"
          style={{ fill: 'var(--bar-peak)', fontWeight: 700 }}
        >
          Peak {compact(max)}
        </text>
      )}
    </svg>
  );
}

/** The smallest axis top at or above the value that splits into four even, round steps (e.g. 700 -> 800). */
export function niceCeil(value: number): number {
  if (value <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(value / 4));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= value) ?? 10 * pow;
  return step * 4;
}

function compact(n: number): string {
  return n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n));
}
