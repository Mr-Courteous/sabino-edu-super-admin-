import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ErrorNote, Spinner } from '../components/ui';

export default function Login() {
  const { admin, login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); nav(from, { replace: true }); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  };

  return (
    <div className="notebook">
      <div className="signin">
        <div className="brand"><span className="brand-mark" />Sabino Control</div>
        <h1>Sign in</h1>
        <p className="muted" style={{ marginTop: 6 }}>For Sabino Edu administrators.</p>
        <form onSubmit={submit}>
          {!!error && <ErrorNote error={error} />}
          <label className="field"><span>Email</span>
            <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field"><span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? <Spinner /> : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
