import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { fmtDateTime } from '../lib/format';
import { ErrorNote, PageHead, Spinner } from '../components/ui';

export default function Account() {
  const { admin, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);
  const forced = !!admin?.must_change_password;

  const save = useMutation({
    mutationFn: () => api('/auth/change-password', { method: 'POST', body: { currentPassword: f.currentPassword, newPassword: f.newPassword } }),
    onSuccess: async () => { await refresh(); toast('Password updated.'); setF({ currentPassword: '', newPassword: '', confirm: '' }); if (forced) nav('/', { replace: true }); },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return setMismatch(true);
    setMismatch(false); save.mutate();
  };

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <PageHead title="Account" />
      {forced && <div className="note info">You’re using a one-time password. Set your own to continue.</div>}
      <section className="panel">
        <dl className="kv">
          <dt>Name</dt><dd>{admin?.name}</dd>
          <dt>Email</dt><dd>{admin?.email}</dd>
          <dt>Role</dt><dd>{admin?.role}</dd>
          <dt>Last sign-in</dt><dd>{admin?.last_login_at ? fmtDateTime(admin.last_login_at) : '—'}</dd>
        </dl>
      </section>
      <section className="panel">
        <h2 style={{ marginBottom: 14 }}>Change password</h2>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          {save.error && <ErrorNote error={save.error} />}
          {mismatch && <div className="note error" role="alert">The new passwords don’t match.</div>}
          <label className="field"><span>{forced ? 'One-time password' : 'Current password'}</span>
            <input type="password" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></label>
          <label className="field"><span>New password</span>
            <input type="password" autoComplete="new-password" required minLength={10} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
            <small>At least 10 characters.</small></label>
          <label className="field"><span>Repeat new password</span>
            <input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></label>
          <div><button className="btn primary" disabled={save.isPending}>{save.isPending ? <Spinner /> : 'Update password'}</button></div>
        </form>
      </section>
    </div>
  );
}
