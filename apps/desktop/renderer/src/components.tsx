import { useEffect, useId, type ReactNode } from 'react';
import type { MemberStatus } from './api/types';
import { formatPeso } from './format';

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
