import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { actionLabel, describe, fmtDateTime } from '../lib/format';
import type { AuditEntry } from '../lib/types';
import { Empty, ErrorNote, PageHead, Pagination, useDebounced } from '../components/ui';

export default function AuditLog() {
  const [sp, setSp] = useSearchParams();
  const f = {
    adminEmail: sp.get('adminEmail') ?? '', action: sp.get('action') ?? '', targetType: sp.get('targetType') ?? '',
    targetId: sp.get('targetId') ?? '', from: sp.get('from') ?? '', to: sp.get('to') ?? '', q: sp.get('q') ?? '',
  };
  const page = Number(sp.get('page') ?? 1);
  const [text, setText] = useState(f.q);
  const search = useDebounced(text);
  const [open, setOpen] = useState<number | null>(null);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };
  useEffect(() => { if (search !== f.q) update({ q: search }); /* eslint-disable-next-line */ }, [search]);

  const options = useQuery({ queryKey: ['audit', 'filters'], queryFn: () => api<{ actions: string[]; actors: string[] }>('/audit-logs/filters').then((r) => r.data) });
  const { data, error, isFetching } = useQuery({
    queryKey: ['audit', f, page],
    queryFn: () => api<AuditEntry[]>('/audit-logs', {
      query: { ...f, search: f.q, from: f.from ? new Date(f.from).toISOString() : '', to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : '', page },
    }),
    placeholderData: keepPreviousData,
  });
  const filtered = Object.entries(f).some(([k, v]) => v && k !== 'q') || f.q;

  return (
    <div className="stack">
      <PageHead title="Audit log">Every sign-in and every change made from this console. Entries can’t be edited or deleted.</PageHead>
      <div>
        <div className="filters">
          <input type="search" placeholder="Search the log" aria-label="Search audit log" value={text} onChange={(e) => setText(e.target.value)} />
          <select aria-label="Admin" value={f.adminEmail} onChange={(e) => update({ adminEmail: e.target.value })}>
            <option value="">All admins</option>{options.data?.actors.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select aria-label="Action" value={f.action} onChange={(e) => update({ action: e.target.value })}>
            <option value="">All actions</option>{options.data?.actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
          <label className="row small muted">From <input type="date" value={f.from} onChange={(e) => update({ from: e.target.value })} /></label>
          <label className="row small muted">To <input type="date" value={f.to} onChange={(e) => update({ to: e.target.value })} /></label>
          {filtered && <button className="chip" onClick={() => { setText(''); setSp({}, { replace: true }); }}>Clear filters</button>}
        </div>
        {(f.targetType || f.targetId) && <p className="note info" style={{ marginBottom: 14 }}>Showing entries for {f.targetType || 'item'} #{f.targetId}.</p>}
        {!!error && <ErrorNote error={error} />}
        <div className="ledger-wrap" style={{ opacity: isFetching ? 0.7 : 1 }}>
          {data && data.data.length === 0 ? <Empty title="No entries match" /> : (
            <table className="ledger cards">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th /></tr></thead>
              <tbody>{data?.data.map((e) => (
                <Fragment key={e.id}>
                  <tr>
                    <td data-label="When" className="nowrap">{fmtDateTime(e.created_at)}</td>
                    <td data-label="Who"><span className="cell-title">{e.admin_name || e.admin_email}</span>{e.admin_name && <span className="cell-sub">{e.admin_email}</span>}</td>
                    <td data-label="What">
                      <span className="cell-title">{actionLabel(e.action)}</span>
                      {e.target_label && (e.target_type === 'school' && e.target_id
                        ? <Link to={`/schools/${e.target_id}`} className="small">{e.target_label}</Link>
                        : <span className="cell-sub">{e.target_label}</span>)}
                      <div className="small">{describe(e)}</div>
                    </td>
                    <td className="num"><button className="chip" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>{open === e.id ? 'Hide' : 'Details'}</button></td>
                  </tr>
                  {open === e.id && (
                    <tr><td colSpan={4} style={{ background: '#f6f9fd' }}>
                      <dl className="kv small"><dt>IP address</dt><dd>{e.ip ?? '—'}</dd><dt>Entry id</dt><dd>{e.id}</dd><dt>Data</dt><dd><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{e.details ? JSON.stringify(e.details, null, 2) : 'None'}</pre></dd></dl>
                    </td></tr>
                  )}
                </Fragment>
              ))}</tbody>
            </table>
          )}
        </div>
        <Pagination p={data?.pagination} onPage={(n) => update({ page: String(n) })} />
      </div>
    </div>
  );
}
