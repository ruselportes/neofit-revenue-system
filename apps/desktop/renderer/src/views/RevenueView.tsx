import { useState } from 'react';
import { saveFile } from '../download';
import { BarChart, Notice, StatCard } from '../components';
import { formatPeso, monthName, percentText, shiftMonth } from '../format';
import { messageOf, useApp, useAsync } from '../state';

type Series = 'revenue' | 'logbook' | 'payments';

const TABS: Array<{ id: Series; label: string }> = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'logbook', label: 'Logbook entries' },
  { id: 'payments', label: 'Payments' },
];

export default function RevenueView() {
  const { api } = useApp();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [series, setSeries] = useState<Series>('revenue');
  const report = useAsync(() => api.revenue.month(period.year, period.month), [api, period.year, period.month]);
  const r = report.data;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();

  const download = async () => {
    setDownloading(true);
    setDownloadError(undefined);
    try {
      const file = await api.revenue.report(period.year, period.month);
      saveFile(file, `NeoFit-Revenue-${period.year}-${String(period.month).padStart(2, '0')}.docx`);
    } catch (err) {
      setDownloadError(messageOf(err));
    } finally {
      setDownloading(false);
    }
  };

  const points = (r?.days ?? []).map((d) => ({
    label: d.date.slice(8),
    value: series === 'revenue' ? d.total : series === 'logbook' ? d.logbook : d.payments,
  }));
  const share = (part: number) => (r && r.total > 0 ? (part / r.total) * 100 : 0);
  const planTotal = r?.byCategory.reduce((sum, c) => sum + c.revenue, 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Revenue</h1>
          <p>Reconciled revenue: each payment is counted once, even when it appears in both the logbook and a member payment.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={download} disabled={downloading || !r}>
            {downloading ? 'Preparing…' : 'Download Report'}
          </button>
        <div className="month-nav">
          <button className="btn small" aria-label="Previous month" onClick={() => setPeriod(shiftMonth(period.year, period.month, -1))}>
            ‹
          </button>
          <strong aria-live="polite">{monthName(period.year, period.month)}</strong>
          <button className="btn small" aria-label="Next month" onClick={() => setPeriod(shiftMonth(period.year, period.month, 1))}>
            ›
          </button>
        </div>
        </div>
      </div>

      {downloadError && <Notice kind="error">{downloadError}</Notice>}
      {report.error && <Notice kind="error">{report.error}</Notice>}
      {r?.logbookStale && (
        <Notice kind="error">
          The logbook could not be refreshed from the cloud, so its figures may be missing or out of date. Member payments are
          complete.
        </Notice>
      )}
      {!r && !report.error && <Notice>Loading…</Notice>}

      {r && (
        <>
          <section className="card" aria-label="Daily revenue">
            <div className="page-head" style={{ marginBottom: 8 }}>
              <div>
                <div className="hint">Total revenue</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{formatPeso(r.total)}</div>
                <div className="hint">
                  {r.previous.changePercent === null
                    ? `No revenue in ${monthName(r.previous.year, r.previous.month)} to compare with`
                    : `${percentText(r.previous.changePercent)} from ${monthName(r.previous.year, r.previous.month)} (${formatPeso(r.previous.total)})`}
                </div>
              </div>
              <div className="tabs" role="tablist">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={series === t.id} onClick={() => setSeries(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <BarChart points={points} title={`Daily ${series} for ${monthName(r.year, r.month)}`} />
          </section>

          <div className="cards" style={{ marginTop: 16 }}>
            <StatCard label="This month" value={formatPeso(r.total)} />
            <StatCard label="This year" value={formatPeso(r.yearTotal)} sub={String(r.year)} />
          </div>

          <div className="two-col">
            <section className="card" aria-labelledby="by-source">
              <h2 id="by-source" style={{ marginBottom: 12 }}>By source</h2>
              <div className="bars">
                <div className="row">
                  <span>Logbook scans</span>
                  <div className="meter"><div style={{ width: `${share(r.logbookTotal)}%` }} /></div>
                  <strong className="num">{formatPeso(r.logbookTotal)}</strong>
                </div>
                <div className="row">
                  <span>Member payments</span>
                  <div className="meter"><div style={{ width: `${share(r.paymentsTotal)}%` }} /></div>
                  <strong className="num">{formatPeso(r.paymentsTotal)}</strong>
                </div>
              </div>
            </section>
            <section className="card" aria-labelledby="by-plan">
              <h2 id="by-plan" style={{ marginBottom: 12 }}>By plan</h2>
              {r.byCategory.length === 0 ? (
                <div className="empty">No revenue this month.</div>
              ) : (
                <div className="bars">
                  {r.byCategory.map((c) => (
                    <div className="row" key={c.category}>
                      <span>{c.category}</span>
                      <div className="meter"><div style={{ width: `${planTotal ? (c.revenue / planTotal) * 100 : 0}%` }} /></div>
                      <strong className="num">{formatPeso(c.revenue)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
