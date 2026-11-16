import { useEffect, useState, type FormEvent } from 'react';
import type { Api } from '../api/resources';
import type { Session, SessionWithKey } from '../api/types';
import { Notice, PasswordInput, RecoveryKeyPanel } from '../components';
import { messageOf } from '../state';
import logoImg from '../assets/logo.png';

type Mode = 'signin' | 'setup' | 'forgot' | 'key';

/** The running version, so it is easy to tell which build is open (and whether an update has arrived). */
function LoginVersion() {
  return <div className="login-version">NeoFit Revenue System · v{window.neofit?.version ?? 'dev'}</div>;
}

/** Sign in, create the administrator account the first time, or reset a forgotten password with the recovery key. */
export default function LoginView({ api, onSignedIn }: { api: Api; onSignedIn: (s: Session) => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [issued, setIssued] = useState<SessionWithKey | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // First-run setup can also take the owner's login for the cloud (optional). It is checked before the account is made
  // and saved after the recovery key is kept, because saving restarts the app.
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [pendingCloud, setPendingCloud] = useState<{ ownerEmail: string; ownerPassword: string } | null>(null);
  const [restarting, setRestarting] = useState(false);
  const canConnect = typeof window.neofit?.checkCloudLogin === 'function' && typeof window.neofit?.saveCloudConfig === 'function';

  useEffect(() => {
    api.auth.needsSetup().then(
      (r) => setMode(r.needsSetup ? 'setup' : 'signin'),
      (e: unknown) => {
        setMode('signin');
        setError(messageOf(e));
      },
    );
  }, [api]);

  if (mode === null) return <div className="center">Starting…</div>;

  const goTo = (next: Mode) => {
    setError(undefined);
    setPassword('');
    setConfirm('');
    setMode(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if ((mode === 'setup' || mode === 'forgot') && password !== confirm) return setError('The passwords do not match.');
    const wantsCloud = mode === 'setup' && canConnect && (cloudEmail.trim() !== '' || cloudPassword !== '');
    if (wantsCloud && (!cloudEmail.trim() || !cloudPassword)) return setError('Enter both the owner email and the owner password, or leave both empty.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        onSignedIn(await api.auth.login(email, password));
      } else {
        if (wantsCloud) {
          // Prove the owner login works before anything is created, so a typo does not leave a half-finished setup.
          const check = await window.neofit!.checkCloudLogin!({ ownerEmail: cloudEmail.trim(), ownerPassword: cloudPassword });
          if (!check.ok) {
            setError(check.error);
            setBusy(false);
            return;
          }
          setPendingCloud({ ownerEmail: cloudEmail.trim(), ownerPassword: cloudPassword });
        }
        // Both setup and reset end with a new recovery key that must be saved before the app opens.
        const result = await (mode === 'setup' ? api.auth.setup(email, password) : api.auth.resetPassword(email, recoveryKey, password));
        setIssued(result);
        setMode('key');
      }
    } catch (err) {
      setError(messageOf(err));
    }
    setBusy(false);
  };

  // After the recovery key is saved: connect to the cloud if the owner's login was given (this restarts the app), else open the app.
  const finishSetup = async () => {
    if (!issued) return;
    if (pendingCloud) {
      const saved = await window.neofit!.saveCloudConfig!(pendingCloud);
      if (saved.ok) return setRestarting(true);
    }
    onSignedIn(issued);
  };

  if (restarting) {
    return (
      <div className="login">
        <LoginVersion />
        <div className="card">
          <img className="login-logo" src={logoImg} alt="NeoFit Fitness Gym" />
          <Notice kind="ok">Connected to the cloud. The app is restarting. Sign in with the account you just created.</Notice>
        </div>
      </div>
    );
  }

  if (mode === 'key' && issued) {
    return (
      <div className="login">
        <LoginVersion />
        <div className="card">
          <img className="login-logo" src={logoImg} alt="NeoFit Fitness Gym" />
          <div>
            <h1>Save your recovery key</h1>
            <p className="hint">If you forget the password, this key lets you set a new one. There is no other way to get back in.</p>
          </div>
          <RecoveryKeyPanel recoveryKey={issued.recoveryKey} doneLabel="Continue" onDone={() => void finishSetup()} />
        </div>
      </div>
    );
  }

  const title = mode === 'setup' ? 'Create the administrator account' : mode === 'forgot' ? 'Reset your password' : 'Sign in';
  const subtitle =
    mode === 'setup'
      ? 'This is the only account for this computer. Keep the password safe.'
      : mode === 'forgot'
        ? 'Enter the recovery key you saved when the account was created.'
        : 'Revenue Collection and Monitoring System';
  const newPassword = mode === 'setup' || mode === 'forgot';

  return (
    <div className="login">
      <LoginVersion />
      <form className="card" onSubmit={submit}>
        <img className="login-logo" src={logoImg} alt="NeoFit Fitness Gym" />
        <div>
          <h1>{title}</h1>
          <p className="hint">{subtitle}</p>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        {mode === 'forgot' && (
          <label className="field">
            <span>Recovery key</span>
            <input
              className="input key-input"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
        )}
        <label className="field">
          <span>{mode === 'forgot' ? 'New password' : 'Password'}</span>
          <PasswordInput
            autoComplete={newPassword ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={newPassword ? 8 : undefined}
            required
          />
        </label>
        {newPassword && (
          <label className="field">
            <span>Confirm password</span>
            <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <span className="hint">At least 8 characters.</span>
          </label>
        )}
        {mode === 'setup' && canConnect && (
          <fieldset className="cloud-fields">
            <legend>Cloud login (optional)</legend>
            <p className="hint">
              The owner account of the gym's online data, for the Logbook and Announcements. You can also add it later from the Logbook.
            </p>
            <label className="field">
              <span>Owner email</span>
              <input className="input" type="email" value={cloudEmail} onChange={(e) => setCloudEmail(e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span>Owner password</span>
              <PasswordInput value={cloudPassword} onChange={(e) => setCloudPassword(e.target.value)} autoComplete="off" />
            </label>
          </fieldset>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'setup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in'}
        </button>
        {mode === 'signin' && (
          <button type="button" className="link" onClick={() => goTo('forgot')}>Forgot password?</button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="link" onClick={() => goTo('signin')}>Back to sign in</button>
        )}
      </form>
    </div>
  );
}
