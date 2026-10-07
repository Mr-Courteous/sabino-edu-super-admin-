import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import type { AudienceInfo, NotificationResult, School, SentNotification } from '../lib/types';
import { ConfirmModal } from '../components/Modal';
import { Empty, PageHead, Pagination, Spinner, When, useDebounced } from '../components/ui';

const TITLE_MAX = 65;
const BODY_MAX = 240;

// Shown even when the server can't be reached, so the form never looks broken.
const AUDIENCE_FALLBACK: AudienceInfo[] = [
  { id: 'all', label: 'Everyone with the app', devices: null, needs: null },
  { id: 'subscribed', label: 'Schools with active access', devices: null, needs: null },
  { id: 'unsubscribed', label: 'Schools without active access', devices: null, needs: null },
  { id: 'anonymous', label: 'People who haven’t signed in yet', devices: null, needs: null },
  { id: 'outdated', label: 'Devices on an older app version', devices: null, needs: 'version' },
  { id: 'school', label: 'One school', devices: null, needs: 'schoolId' },
];

const AUDIENCE_HELP: Record<string, string> = {
  all: 'Every device that has allowed notifications.',
  subscribed: 'Schools whose subscription is active right now. Good for updates and thank-yous.',
  unsubscribed: 'Schools that haven’t paid or whose access has ended. Good for reminders.',
  anonymous: 'People who installed the app but never signed in.',
  outdated: 'Devices not on the version you enter below.',
  school: 'Every device signed in to one school.',
};

export default function Notifications() {
  const qc = useQueryClient();
  const toast = useToast();
  const [audience, setAudience] = useState('subscribed');
  const [version, setVersion] = useState('');
  const [schoolText, setSchoolText] = useState('');
  const [school, setSchool] = useState<School | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const versionQ = useDebounced(version.trim());
  const schoolQ = useDebounced(schoolText.trim());

  const audiences = useQuery({
    queryKey: ['notif-audiences', versionQ],
    queryFn: () => api<AudienceInfo[]>('/notifications/audiences', { query: { version: versionQ } }).then((r) => r.data),
  });
  const matches = useQuery({
    queryKey: ['notif-school-search', schoolQ], enabled: audience === 'school' && schoolQ.length >= 2 && !school,
    queryFn: () => api<School[]>('/schools', { query: { search: schoolQ, limit: 5 } }).then((r) => r.data),
  });
  const history = useQuery({
    queryKey: ['notif-history', page], placeholderData: keepPreviousData,
    queryFn: () => api<SentNotification[]>('/notifications/history', { query: { page } }),
  });

  const options = audiences.data ?? AUDIENCE_FALLBACK;
  const serverProblem = audiences.error ?? history.error;
  const current = options.find((a) => a.id === audience);
  const devices = audience === 'school' ? null : current?.devices ?? null;
  const needsVersion = audience === 'outdated';
  const needsSchool = audience === 'school';
  const ready = title.trim() && body.trim() && (!needsVersion || versionQ) && (!needsSchool || school) && devices !== 0 && !audiences.error;

  const send = useMutation({
    mutationFn: () => api<NotificationResult>('/notifications/send', {
      method: 'POST', body: { audience, title: title.trim(), body: body.trim(), version: versionQ || undefined, schoolId: school?.id },
    }).then((r) => r.data),
    onSuccess: (r) => {
      setConfirming(false); setTitle(''); setBody('');
      toast(r.failed ? `Delivered to ${r.sent} of ${r.recipients} devices. ${r.failed} didn’t go through.` : `Delivered to ${r.sent} device${r.sent === 1 ? '' : 's'}.`);
      ['notif-history', 'notif-audiences', 'audit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => { setConfirming(false); toast(e instanceof Error ? e.message : 'Could not send.', 'error'); },
  });

  const submit = (e: FormEvent) => { e.preventDefault(); if (ready) setConfirming(true); };
  const where = needsSchool ? school?.name ?? 'the chosen school' : current?.label.toLowerCase() ?? 'the chosen audience';

  return (
    <div className="stack">
      <PageHead title="Notifications">Send a push notification to the Sabino Edu app. Every send is recorded in the audit log with your name.</PageHead>
      {serverProblem && (
        <div className="note error" role="alert">
          <b>Notifications aren’t available right now.</b> {serverProblem instanceof Error ? serverProblem.message : ''}{' '}
          <button type="button" className="chip" onClick={() => { audiences.refetch(); history.refetch(); }}>Try again</button>
        </div>
      )}

      <div className="split">
        <form className="panel" onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <label className="field"><span>Send to</span>
            <select value={audience} onChange={(e) => { setAudience(e.target.value); setSchool(null); setSchoolText(''); }}>
              {options.map((a) => (
                <option key={a.id} value={a.id}>{a.label}{a.devices !== null ? ` (${a.devices} device${a.devices === 1 ? '' : 's'})` : ''}</option>
              ))}
            </select>
            <small>{devices !== null && <b>{devices} device{devices === 1 ? '' : 's'} will receive this. </b>}{AUDIENCE_HELP[audience]}</small>
          </label>

          {needsVersion && (
            <label className="field"><span>Current app version</span>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="For example 2.0.0" />
              <small>{versionQ ? `${devices ?? '…'} device${devices === 1 ? ' is' : 's are'} on a different version.` : 'Enter the latest version to see who is behind.'}</small>
            </label>
          )}

          {needsSchool && (
            <div className="field"><span>School</span>
              {school ? (
                <div className="row"><b>{school.name}</b><button type="button" className="chip" onClick={() => { setSchool(null); setSchoolText(''); }}>Change</button></div>
              ) : (
                <>
                  <input type="search" value={schoolText} onChange={(e) => setSchoolText(e.target.value)} placeholder="Search by name or email" aria-label="Search schools" />
                  {matches.data?.length === 0 && <small>No school found.</small>}
                  {matches.data?.map((m) => (
                    <button type="button" key={m.id} className="pick" onClick={() => setSchool(m)}><b>{m.name}</b><span className="cell-sub">{m.email}</span></button>
                  ))}
                </>
              )}
            </div>
          )}

          <label className="field"><span>Title</span>
            <input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} required />
            <small className="counter">{title.length}/{TITLE_MAX}</small>
          </label>
          <label className="field"><span>Message</span>
            <textarea value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} required />
            <small className="counter">{body.length}/{BODY_MAX}</small>
          </label>

          {(title || body) && (
            <div className="preview" aria-label="Preview">
              <span className="small muted">Sabino Edu</span>
              <b>{title || 'Title'}</b>
              <span>{body || 'Message'}</span>
            </div>
          )}

          {devices === 0 && <div className="note info">No devices match this audience right now.</div>}
          <div><button className="btn primary" disabled={!ready || send.isPending}>{send.isPending ? <Spinner /> : <><Send size={16} />Review and send</>}</button></div>
        </form>

        <section>
          <div className="section-head"><h2>Sent notifications</h2></div>
          {history.isLoading && <Spinner />}
          <div className="ledger-wrap" hidden={!history.data}>
            {history.data && history.data.data.length === 0 ? <Empty title="Nothing sent yet" /> : history.data && (
              <table className="ledger cards">
                <thead><tr><th>When</th><th>Message</th><th>Result</th></tr></thead>
                <tbody>{history.data?.data.map((n) => (
                  <tr key={n.id}>
                    <td data-label="When"><When value={n.created_at} /></td>
                    <td data-label="Message">
                      <span className="cell-title">{n.details.title}</span>
                      <span className="cell-sub">{n.details.body}</span>
                      <span className="cell-sub">To {n.target_label ?? n.details.audienceLabel.toLowerCase()}, by {n.admin_name || n.admin_email}</span>
                    </td>
                    <td data-label="Result">{n.details.sent} of {n.details.recipients}{n.details.failed ? <span className="cell-sub">{n.details.failed} failed</span> : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <Pagination p={history.data?.pagination} onPage={setPage} />
        </section>
      </div>

      {confirming && (
        <ConfirmModal
          title="Send this notification?"
          body={<>“{title.trim()}” will be sent to {devices !== null ? <b>{devices} device{devices === 1 ? '' : 's'}</b> : 'every device of'} {devices !== null ? `(${where})` : <b>{where}</b>}. This can’t be undone.</>}
          confirmLabel="Send now" busy={send.isPending} onClose={() => setConfirming(false)} onConfirm={() => send.mutate()}
        />
      )}
    </div>
  );
}
