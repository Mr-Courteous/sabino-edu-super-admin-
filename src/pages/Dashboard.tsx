import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { actionLabel, describe, expiryNote, fmtDate, fmtDateTime } from '../lib/format';
import type { AuditEntry, School, Stats } from '../lib/types';
import { Empty, ErrorNote, PageHead, Spinner, StatusMark } from '../components/ui';

function SchoolList({ rows, empty, showExpiry }: { rows?: School[]; empty: string; showExpiry?: boolean }) {
  const nav = useNavigate();
  if (!rows) return <div className="panel"><Spinner /></div>;
  if (!rows.length) return <div className="ledger-wrap"><Empty title={empty} /></div>;
  return (
    <div className="ledger-wrap">
      <table className="ledger cards">
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="click" onClick={() => nav(`/schools/${s.id}`)}>
              <td><Link to={`/schools/${s.id}`} className="cell-title">{s.name}</Link><span className="cell-sub">{s.email}</span></td>
              <td className="num">
                {showExpiry
                  ? <><b>{fmtDate(s.subscription_expiry)}</b><span className="cell-sub" style={{ display: 'block' }}>{expiryNote(s.subscription_expiry)}</span></>
                  : <span className="cell-sub">Joined {fmtDateTime(s.created_at)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats').then((r) => r.data) });
  const expiring = useQuery({ queryKey: ['schools', 'expiring'], queryFn: () => api<School[]>('/schools', { query: { expiring: 7, sort: 'expiry', limit: 8 } }).then((r) => r.data) });
  const waiting = useQuery({ queryKey: ['schools', 'waiting'], queryFn: () => api<School[]>('/schools', { query: { status: 'pending', limit: 8 } }).then((r) => r.data) });
  const activity = useQuery({
    queryKey: ['audit', 'recent'], enabled: can('owner', 'admin'),
    queryFn: () => api<AuditEntry[]>('/audit-logs', { query: { limit: 8 } }).then((r) => r.data),
  });

  const s = stats.data;
  const headline = !s ? 'Loading…'
    : s.expiring_soon > 0 ? `${s.expiring_soon} subscription${s.expiring_soon === 1 ? ' ends' : 's end'} within 7 days.`
    : 'No subscriptions end this week.';

  return (
    <div className="stack">
      <PageHead title="Overview">{headline}</PageHead>
      {stats.error && <ErrorNote error={stats.error} />}
      {s && (
        <>
          <div className="register">
            <Link to="/schools?status=completed"><b>{s.completed}</b><span className="mark completed">Completed</span></Link>
            <Link to="/schools?status=grace_period"><b>{s.grace_period}</b><span className="mark grace_period">Grace period</span></Link>
            <Link to="/schools?status=expired"><b>{s.expired}</b><span className="mark expired">Expired</span></Link>
            <Link to="/schools?status=pending"><b>{s.pending}</b><span className="mark pending">Pending</span></Link>
          </div>
          <div className="facts">
            <span><b>{s.total}</b> schools</span>
            <span><b>{s.new_30d}</b> joined in the last 30 days</span>
            <span><b>{s.students}</b> students</span>
            <span><b>{s.devices}</b> registered devices</span>
          </div>
        </>
      )}
      <div className="split">
        <section>
          <div className="section-head"><h2>Ending within 7 days</h2><Link to="/schools?expiring=7" className="small">See all</Link></div>
          <SchoolList rows={expiring.data} empty="Nothing ending this week" showExpiry />
        </section>
        <section>
          <div className="section-head"><h2>Awaiting first payment</h2><Link to="/schools?status=pending" className="small">See all</Link></div>
          <SchoolList rows={waiting.data} empty="No schools are waiting on payment" />
        </section>
      </div>
      {can('owner', 'admin') && (
        <section>
          <div className="section-head"><h2>Recent admin activity</h2><Link to="/audit" className="small">Open audit log</Link></div>
          {!activity.data ? <div className="panel"><Spinner /></div> : activity.data.length === 0 ? <div className="ledger-wrap"><Empty title="No activity yet" /></div> : (
            <div className="ledger-wrap">
              <table className="ledger cards"><tbody>
                {activity.data.map((e) => (
                  <tr key={e.id}>
                    <td><span className="cell-title">{actionLabel(e.action)}{e.target_label ? `: ${e.target_label}` : ""}</span><span className="cell-sub">{describe(e)}</span></td>
                    <td className="num"><span className="cell-sub">{e.admin_name || e.admin_email}<br />{fmtDateTime(e.created_at)}</span></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
