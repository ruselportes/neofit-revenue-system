import { useEffect, useState, type FormEvent } from 'react';
import type { Api } from '../api/resources';
import type { Session } from '../api/types';
import { Notice } from '../components';
import { messageOf } from '../state';

/** Sign in, or create the administrator account the first time the app runs. */
export default function LoginView({ api, onSignedIn }: { api: Api; onSignedIn: (s: Session) => void }) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.auth.needsSetup().then(
      (r) => setNeedsSetup(r.needsSetup),
      (e: unknown) => {
        setNeedsSetup(false);
        setError(messageOf(e));
      },
    );
  }, [api]);

  if (needsSetup === null) return <div className="center">Starting…</div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (needsSetup && password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      onSignedIn(await (needsSetup ? api.auth.setup(email, password) : api.auth.login(email, password)));
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          NeoFit
        </div>
        <div>
          <h1>{needsSetup ? 'Create the administrator account' : 'Sign in'}</h1>
          <p className="hint">
            {needsSetup ? 'This is the only account for this computer. Keep the password safe.' : 'Revenue Collection and Monitoring System'}
          </p>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={needsSetup ? 8 : undefined}
            required
          />
        </label>
        {needsSetup && (
          <label className="field">
            <span>Confirm password</span>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <span className="hint">At least 8 characters.</span>
          </label>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : needsSetup ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
