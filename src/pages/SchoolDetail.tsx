import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { actionLabel, addToToday, describe, endOfDayISO, expiryNote, fmtDate, fmtDateTime, money, statusLabel, STATUS_LABEL, toYMD } from '../lib/format';
import type { PaymentStatus, School, SchoolDetail as Detail } from '../lib/types';
import { Modal } from '../components/Modal';
import { Empty, ErrorNote, Spinner, StatusMark, When } from '../components/ui';

const GRACE_DAYS = 3;
const STATUS_HELP: Record<PaymentStatus, string> = {
  completed: 'Full access until the expiry date.',
  grace_period: `Full access for ${GRACE_DAYS} more days from now, then it expires.`,
  expired: 'Access blocked. The expiry date is kept for reference.',
  pending: 'Access blocked. Any expiry date is cleared.',
};
const REASONS = ['Bank transfer confirmed', 'Paid via Flutterwave, webhook missed', 'Store purchase not synced', 'Complimentary access', 'Grace period requested'];

function StatusModal({ school, onClose }: { school: School; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const currentFuture = school.subscription_expiry && new Date(school.subscription_expiry) > new Date();
  const [status, setStatus] = useState<PaymentStatus>('completed');
  const [expiry, setExpiry] = useState(currentFuture ? toYMD(new Date(school.subscription_expiry!)) : addToToday({ days: 30 }));
  const [reason, setReason] = useState('');
  const needsDate = status === 'completed';
  const graceEnd = new Date(Date.now() + GRACE_DAYS * 86400000);
  const expiryInPast = needsDate && expiry !== '' && new Date(endOfDayISO(expiry)) <= new Date();
  const shortens = status === 'grace_period' && currentFuture && new Date(school.subscription_expiry!) > graceEnd;

  const save = useMutation({
    mutationFn: () => api<School>(`/schools/${school.id}/payment-status`, {
      method: 'PATCH', body: { status, reason: reason.trim(), ...(needsDate ? { expiryDate: endOfDayISO(expiry) } : {}) },
    }),
    onSuccess: (r) => {
      toast(r.message ?? 'Payment status updated.');
      ['school', 'schools', 'stats', 'audit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not update.', 'error'),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const after = status === 'pending' ? 'no expiry' : status === 'grace_period' ? `until ${fmtDate(graceEnd.toISOString())}` : needsDate ? `until ${fmtDate(endOfDayISO(expiry))}` : school.subscription_expiry ? `expiry kept: ${fmtDate(school.subscription_expiry)}` : 'no expiry';

  return (
    <Modal title="Change payment status" subtitle={school.name} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <span>New status</span>
          <div className="choices" role="group" aria-label="New status">
            {(Object.keys(STATUS_LABEL) as PaymentStatus[]).map((s) => (
              <button type="button" key={s} className="choice" aria-pressed={status === s} onClick={() => setStatus(s)}>
                <StatusMark status={s} />
              </button>
            ))}
          </div>
          <small>{STATUS_HELP[status]}</small>
        </div>

        {status === 'grace_period' && (
          <div className="note info">
            Access will continue until <b>{fmtDate(graceEnd.toISOString())}</b> ({GRACE_DAYS} days from now).
            {shortens && <> <b>This shortens their subscription</b>, which currently ends {fmtDate(school.subscription_expiry)}.</>}
          </div>
        )}

        {needsDate && (
          <div className="field">
            <label htmlFor="expiry"><b>Subscription ends</b></label>
            <input id="expiry" type="date" required value={expiry} min={toYMD(new Date())} onChange={(e) => setExpiry(e.target.value)} />
            <div className="chips">
              <button type="button" className="chip" onClick={() => setExpiry(addToToday({ days: 30 }))}>30 days from today</button>
              <button type="button" className="chip" onClick={() => setExpiry(addToToday({ months: 3 }))}>3 months</button>
              <button type="button" className="chip" onClick={() => setExpiry(addToToday({ months: 12 }))}>1 year</button>
            </div>
            {expiryInPast && <small style={{ color: 'var(--bad)' }}>Choose a date after today.</small>}
          </div>
        )}

        <div className="field">
          <label htmlFor="reason"><b>Reason</b></label>
          <textarea id="reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Saved in the audit log with your name" />
          <div className="chips">{REASONS.map((r) => <button type="button" key={r} className="chip" onClick={() => setReason(r)}>{r}</button>)}</div>
        </div>

        <div className="change" aria-label="Summary of change">
          <div className="line"><span>Before</span><StatusMark status={school.payment_status} /><span className="muted">{school.subscription_expiry ? `until ${fmtDate(school.subscription_expiry)}` : 'no expiry'}</span></div>
          <div className="line"><span>After</span><StatusMark status={status} /><span className="muted">{after}</span></div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={save.isPending || expiryInPast || reason.trim().length < 3}>
            {save.isPending ? <Spinner /> : `Set to ${STATUS_LABEL[status].toLowerCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SchoolDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data: s, error, isLoading } = useQuery({
    queryKey: ['school', id], queryFn: () => api<Detail>(`/schools/${id}`).then((r) => r.data),
  });

  const lastChange = s?.activity.find((a) => a.action === 'school.payment_status_changed');

  if (isLoading) return <Spinner />;
  if (error || !s) return <div className="stack"><Link to="/schools"><ArrowLeft size={14} /> Schools</Link><ErrorNote error={error} /></div>;

  return (
    <div className="stack">
      <div>
        <Link to="/schools" className="small row" style={{ gap: 4, marginBottom: 12 }}><ArrowLeft size={14} />Schools</Link>
        <h1>{s.name}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{[s.school_type, s.country].filter(Boolean).join(', ')}</p>
      </div>

      <div className="split">
        <div className="stack">
          <section className={`panel status-panel ${s.payment_status}`}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <div>
                <div className="big"><StatusMark status={s.payment_status} /></div>
                <p style={{ marginTop: 6 }}>
                  {s.subscription_expiry ? <>Subscription ends <b>{fmtDate(s.subscription_expiry)}</b> <span className="muted">({expiryNote(s.subscription_expiry)})</span></> : <span className="muted">No subscription on record.</span>}
                </p>
                {s.paid_at && s.payment_status !== 'pending' && (
                  <p style={{ marginTop: 4 }}>Payment completed <b>{fmtDateTime(s.paid_at)}</b>{s.paid_estimated && <span className="muted"> (approximate)</span>}</p>
                )}
                {lastChange && (
                  <p className="small muted" style={{ marginTop: 8 }}>
                    Last changed by {lastChange.admin_name || lastChange.admin_email} on {fmtDateTime(lastChange.created_at)}{lastChange.details?.reason ? `: “${lastChange.details.reason}”` : ''}
                  </p>
                )}
              </div>
              {can('owner', 'admin') && <button className="btn primary" onClick={() => setEditing(true)}>Change status</button>}
            </div>
          </section>

          <section>
            <div className="section-head"><h2>Status history</h2></div>
            <div className="ledger-wrap">
              {s.status_history.length === 0 ? <Empty title="No changes recorded yet">Changes are recorded from now on, whoever or whatever makes them.</Empty> : (
                <table className="ledger cards">
                  <thead><tr><th>When</th><th>Change</th><th>Ends</th></tr></thead>
                  <tbody>{s.status_history.map((h) => (
                    <tr key={h.id}>
                      <td data-label="When"><When value={h.changed_at} approx={h.estimated} /></td>
                      <td data-label="Change">{h.old_status ? `${statusLabel(h.old_status)} to ${statusLabel(h.new_status)}` : `Became ${statusLabel(h.new_status).toLowerCase()}`}</td>
                      <td data-label="Ends">{fmtDate(h.new_expiry)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <div className="section-head"><h2>Payment attempts</h2></div>
            <div className="ledger-wrap">
              {s.transactions.length === 0 ? <Empty title="No payment attempts">Store purchases and manual changes don’t appear here.</Empty> : (
                <table className="ledger cards">
                  <thead><tr><th>When</th><th>Reference</th><th>Result</th><th className="num">Amount</th></tr></thead>
                  <tbody>{s.transactions.map((t) => (
                    <tr key={t.id}><td data-label="When">{fmtDateTime(t.created_at)}</td><td data-label="Reference">{t.tx_ref ?? t.flutterwave_ref ?? '—'}</td><td data-label="Result">{t.status}</td><td data-label="Amount" className="num">{money(t.amount, t.currency)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <dl className="kv">
              <dt>Email</dt><dd>{s.email ?? '—'}</dd>
              <dt>Phone</dt><dd>{s.phone ?? '—'}</dd>
              <dt>Students</dt><dd><Link to={`/students?schoolId=${s.id}`}>{s.students_count}</Link></dd>
              <dt>Classes</dt><dd>{s.classes_count}</dd>
              <dt>Joined</dt><dd>{fmtDateTime(s.created_at)}</dd>
              <dt>Renewal reminder</dt><dd>{s.renewal_warning_sent_at ? `Sent ${fmtDate(s.renewal_warning_sent_at)}` : 'Not sent'}</dd>
            </dl>
          </section>
          {can('owner', 'admin') && (
            <section>
              <div className="section-head"><h2>Admin history</h2><Link className="small" to={`/audit?targetType=school&targetId=${s.id}`}>Full log</Link></div>
              <div className="panel">
                {s.activity.length === 0 ? <p className="muted">No admin has changed this school yet.</p> : (
                  <ul className="timeline">
                    {s.activity.map((a) => (
                      <li key={a.id}>
                        <span className="what">{actionLabel(a.action)}</span>
                        <div className="small">{describe(a)}</div>
                        <div className="small muted">{a.admin_name || a.admin_email}, {fmtDateTime(a.created_at)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
      {editing && <StatusModal school={s} onClose={() => setEditing(false)} />}
    </div>
  );
}
