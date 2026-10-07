import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { fmtDate, fmtDateTime } from '../lib/format';
import type { Admin, Role } from '../lib/types';
import { ConfirmModal, Modal } from '../components/Modal';
import { ErrorNote, PageHead, Spinner } from '../components/ui';

const ROLE_HELP: Record<Role, string> = {
  owner: 'Everything, including adding and removing admins.',
  admin: 'Schools, payment status, students and the audit log.',
  viewer: 'Read-only access to schools and students.',
};

function TempPassword({ value, onDone, who }: { value: string; onDone: () => void; who: string }) {
  const toast = useToast();
  return (
    <div className="body">
      <p>Give this one-time password to <b>{who}</b>. It is shown only now, and they must change it when they sign in.</p>
      <div className="secret">
        <span>{value}</span>
        <button className="btn small" onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied.'))}><Copy size={14} />Copy</button>
      </div>
      <div className="modal-actions"><button className="btn primary" onClick={onDone}>Done</button></div>
    </div>
  );
}

function AddAdmin({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' as Role });
  const [created, setCreated] = useState<{ admin: Admin; tempPassword: string } | null>(null);
  const create = useMutation({
    mutationFn: () => api<{ admin: Admin; tempPassword: string }>('/admins', { method: 'POST', body: form }).then((r) => r.data),
    onSuccess: (d) => { setCreated(d); qc.invalidateQueries({ queryKey: ['admins'] }); qc.invalidateQueries({ queryKey: ['audit'] }); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <Modal title={created ? 'Admin added' : 'Add an admin'} onClose={onClose}>
      {created ? <TempPassword value={created.tempPassword} who={created.admin.name} onDone={onClose} /> : (
        <form onSubmit={submit}>
          {create.error && <ErrorNote error={create.error} />}
          <label className="field"><span>Full name</span><input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span>Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="admin">Admin</option><option value="viewer">Viewer</option><option value="owner">Owner</option>
            </select>
            <small>{ROLE_HELP[form.role]}</small>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Add admin'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

type Pending =
  | { kind: 'deactivate' | 'reactivate' | 'reset'; admin: Admin }
  | { kind: 'role'; admin: Admin; role: Role };

export default function Admins() {
  const { admin: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [temp, setTemp] = useState<{ who: string; value: string } | null>(null);
  const { data, error, isLoading } = useQuery({ queryKey: ['admins'], queryFn: () => api<Admin[]>('/admins').then((r) => r.data) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admins'] }); qc.invalidateQueries({ queryKey: ['audit'] }); };
  const act = useMutation({
    mutationFn: async (p: Pending) => {
      if (p.kind === 'reset') return (await api<{ tempPassword: string }>(`/admins/${p.admin.id}/reset-password`, { method: 'POST' })).data.tempPassword;
      const body = p.kind === 'role' ? { role: p.role } : { is_active: p.kind === 'reactivate' };
      await api(`/admins/${p.admin.id}`, { method: 'PATCH', body });
      return null;
    },
    onSuccess: (tempPassword, p) => {
      refresh(); setPending(null);
      if (tempPassword) setTemp({ who: p.admin.name, value: tempPassword }); else toast('Saved.');
    },
    onError: (e) => { setPending(null); toast(e instanceof Error ? e.message : 'Could not save.', 'error'); },
  });

  const copy: Record<Pending['kind'], (p: Pending) => { title: string; body: string; label: string; danger?: boolean }> = {
    deactivate: (p) => ({ title: 'Deactivate admin', body: `${p.admin.name} will be signed out immediately and won’t be able to sign in. Their history stays in the audit log.`, label: 'Deactivate', danger: true }),
    reactivate: (p) => ({ title: 'Reactivate admin', body: `${p.admin.name} will be able to sign in again.`, label: 'Reactivate' }),
    reset: (p) => ({ title: 'Reset password', body: `This replaces ${p.admin.name}’s password with a one-time password. Their current password stops working right away.`, label: 'Reset password', danger: true }),
    role: (p) => ({ title: 'Change role', body: `Make ${p.admin.name} ${(p as { role: Role }).role === 'admin' ? 'an admin' : `a${(p as { role: Role }).role === 'owner' ? 'n' : ''} ${(p as { role: Role }).role}`}? ${ROLE_HELP[(p as { role: Role }).role]}`, label: 'Change role' }),
  };

  return (
    <div className="stack">
      <PageHead title="Admins" actions={<button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} />Add admin</button>}>
        Who can sign in to this console. Everything they do is recorded in the audit log.
      </PageHead>
      {!!error && <ErrorNote error={error} />}
      {isLoading ? <Spinner /> : (
        <div className="ledger-wrap">
          <table className="ledger cards">
            <thead><tr><th>Admin</th><th>Role</th><th>Last sign-in</th><th>Added</th><th /></tr></thead>
            <tbody>{data?.map((a) => {
              const self = a.id === me?.id;
              return (
                <tr key={a.id}>
                  <td>
                    <span className="cell-title">{a.name}{self && <span className="muted"> (you)</span>}</span>
                    <span className="cell-sub">{a.email}</span>
                    {!a.is_active && <span className="off small">Deactivated</span>}
                    {a.is_active && a.must_change_password && <span className="cell-sub">Hasn’t set a password yet</span>}
                  </td>
                  <td data-label="Role">
                    {self || !a.is_active ? <span className="role">{a.role}</span> : (
                      <select aria-label={`Role for ${a.name}`} value={a.role} onChange={(e) => setPending({ kind: 'role', admin: a, role: e.target.value as Role })} style={{ width: 'auto' }}>
                        <option value="owner">owner</option><option value="admin">admin</option><option value="viewer">viewer</option>
                      </select>
                    )}
                  </td>
                  <td data-label="Last sign-in">{a.last_login_at ? fmtDateTime(a.last_login_at) : <span className="muted">Never</span>}</td>
                  <td data-label="Added">{fmtDate(a.created_at)}</td>
                  <td className="num">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Link className="btn small" to={`/audit?adminEmail=${encodeURIComponent(a.email)}`}>Activity</Link>
                      {!self && a.is_active && <button className="btn small" onClick={() => setPending({ kind: 'reset', admin: a })}>Reset password</button>}
                      {!self && (a.is_active
                        ? <button className="btn small" onClick={() => setPending({ kind: 'deactivate', admin: a })}>Deactivate</button>
                        : <button className="btn small" onClick={() => setPending({ kind: 'reactivate', admin: a })}>Reactivate</button>)}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {adding && <AddAdmin onClose={() => setAdding(false)} />}
      {pending && (() => { const c = copy[pending.kind](pending); return (
        <ConfirmModal title={c.title} body={c.body} confirmLabel={c.label} danger={c.danger} busy={act.isPending} onClose={() => setPending(null)} onConfirm={() => act.mutate(pending)} />
      ); })()}
      {temp && <Modal title="Password reset" onClose={() => setTemp(null)}><TempPassword value={temp.value} who={temp.who} onDone={() => setTemp(null)} /></Modal>}
    </div>
  );
}
