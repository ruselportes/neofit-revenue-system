import type { Navigate } from '../App';
import { Notice, StatCard, StatusBadge } from '../components';
import { formatDate, formatPeso, todayText } from '../format';
import { useApp, useAsync } from '../state';

export default function DashboardView({ navigate }: { navigate: Navigate }) {
  const { api } = useApp();
  const now = new Date();
  const data = useAsync(
    async () => {
      const [summary, members, revenue] = await Promise.all([
        api.members.summary(),
        api.members.list(),
        api.revenue.month(now.getFullYear(), now.getMonth() + 1),
      ]);
      return { summary, members, revenue };
    },
    [api],
  );

  const today = todayText(now);
  // Today's logbook comes from the cloud; without the connection the card and the list are left out.
  const logbook = useAsync(async () => ((await api.cloud.status()).configured ? api.cloud.logbookDay(today) : null), [api, today]);
  const d = data.data;
  const todayRevenue = d?.revenue.days.find((x) => x.date === today)?.total ?? 0;
  const alerts = (d?.members ?? []).filter((m) => m.status === 'Expired' || m.status === 'Expiring Soon');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of the gym.</p>
        </div>
        <button className="btn primary" onClick={() => navigate('members', { openForm: true })}>
          Add New Member
        </button>
      </div>

      {data.error && <Notice kind="error">{data.error}</Notice>}
      {!d && !data.error && <Notice>Loading…</Notice>}

      {d && (
        <>
          <div className="cards">
            <StatCard label="Active members" value={String(d.summary.active + d.summary.expiringSoon)} sub="Including expiring soon" />
            {logbook.data && <StatCard label="Logbook entries today" value={String(logbook.data.count)} sub={formatPeso(logbook.data.total)} />}
            <StatCard label="Total members" value={String(d.summary.total)} />
            <StatCard label="Revenue today" value={formatPeso(todayRevenue)} />
            <StatCard label="Revenue this month" value={formatPeso(d.revenue.total)} />
            <StatCard label="Revenue this year" value={formatPeso(d.revenue.yearTotal)} />
          </div>

          {logbook.data && (
            <section className="card" aria-labelledby="today-log" style={{ marginBottom: 16 }}>
              <h2 id="today-log" style={{ marginBottom: 8 }}>Today's logbook entries</h2>
              {logbook.data.entries.length === 0 ? (
                <div className="empty">Nothing has been scanned today.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th className="num">Amount</th><th>Source</th></tr></thead>
                    <tbody>
                      {logbook.data.entries.slice(0, 8).map((e) => (
                        <tr key={e.id}>
                          <td>{e.name}</td>
                          <td className="num">{e.amount === null ? '—' : formatPeso(e.amount)}</td>
                          <td>{e.source === 'scan' ? 'Scanned' : 'Added by hand'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {logbook.data.entries.length > 8 && (
                    <button className="btn small ghost" onClick={() => navigate('logbook')}>
                      See all {logbook.data.entries.length} entries
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {logbook.error && <Notice>Today's logbook could not be loaded: {logbook.error}</Notice>}

          <section className="card" aria-labelledby="alerts">
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h2 id="alerts">Membership alerts</h2>
              <span className="hint">
                {d.summary.expired} expired · {d.summary.expiringSoon} expiring within 7 days
              </span>
            </div>
            {alerts.length === 0 ? (
              <div className="empty">No plans are expired or about to expire.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Plan</th>
                      <th>Expires</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((m) => (
                      <tr key={m.id}>
                        <td>{m.memberId}</td>
                        <td>{m.name}</td>
                        <td>{m.plan}</td>
                        <td>{formatDate(m.expiryDate)}</td>
                        <td>
                          <StatusBadge status={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
