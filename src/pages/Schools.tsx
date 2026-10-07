import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { expiryNote, fmtDate } from '../lib/format';
import type { School } from '../lib/types';
import { Empty, ErrorNote, PageHead, Pagination, StatusMark, When, useDebounced } from '../components/ui';

const TABS: [string, string][] = [['', 'All'], ['completed', 'Completed'], ['grace_period', 'Grace period'], ['expired', 'Expired'], ['pending', 'Pending']];

export default function Schools() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const expiring = sp.get('expiring') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [text, setText] = useState(sp.get('q') ?? '');
  const search = useDebounced(text);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSp(next, { replace: true });
  };
  useEffect(() => { if (search !== (sp.get('q') ?? '')) update({ q: search, page: '' }); /* eslint-disable-next-line */ }, [search]);

  const { data, error, isFetching } = useQuery({
    queryKey: ['schools', { status, expiring, search: sp.get('q') ?? '', page }],
    queryFn: () => api<School[]>('/schools', { query: { status, expiring, search: sp.get('q') ?? '', page, sort: expiring ? 'expiry' : undefined } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      <PageHead title="Schools">Every school on Sabino Edu. Open one to change its payment status.</PageHead>
      <div>
        <div className="filters">
          <input type="search" placeholder="Search schools" aria-label="Search schools" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="tabs" role="group" aria-label="Payment status">
            {TABS.map(([v, label]) => (
              <button key={v} aria-pressed={status === v && !expiring} onClick={() => update({ status: v, expiring: '', page: '' })}>{label}</button>
            ))}
          </div>
        </div>
        {expiring && <p className="note info" style={{ marginBottom: 14 }}>Showing paid schools ending within {expiring} days. <button className="chip" onClick={() => update({ expiring: '', page: '' })}>Clear</button></p>}
        {!!error && <ErrorNote error={error} />}
        <div className="ledger-wrap" style={{ opacity: isFetching ? 0.7 : 1 }}>
          {data && data.data.length === 0 ? <Empty title="No schools match">Try a different search or status.</Empty> : (
            <table className="ledger cards">
              <thead><tr><th>School</th><th>Payment</th><th>Subscription ends</th><th>Paid on</th><th>Country</th><th>Joined</th></tr></thead>
              <tbody>
                {data?.data.map((s) => (
                  <tr key={s.id} className="click" onClick={() => nav(`/schools/${s.id}`)}>
                    <td><Link to={`/schools/${s.id}`} className="cell-title" onClick={(e) => e.stopPropagation()}>{s.name}</Link><span className="cell-sub">{[s.email, s.phone].filter(Boolean).join(", ")}</span></td>
                    <td data-label="Payment"><StatusMark status={s.payment_status} /></td>
                    <td data-label="Subscription ends">{s.subscription_expiry ? <>{fmtDate(s.subscription_expiry)}<span className="cell-sub" style={{ display: 'block' }}>{expiryNote(s.subscription_expiry)}</span></> : <span className="muted">—</span>}</td>
                    <td data-label="Paid on">{s.paid_at && s.payment_status !== 'pending' ? <When value={s.paid_at} approx={!!s.paid_estimated} /> : <span className="muted">—</span>}</td>
                    <td data-label="Country">{s.country ?? '—'}</td>
                    <td data-label="Joined"><When value={s.created_at} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination p={data?.pagination} onPage={(n) => update({ page: String(n) })} />
      </div>
    </div>
  );
}
