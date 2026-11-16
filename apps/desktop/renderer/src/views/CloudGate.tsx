import { useState, type FormEvent, type ReactNode } from 'react';
import { Notice, PasswordInput } from '../components';
import { useApp, useAsync } from '../state';

/** Shows its content only when the cloud connection is set up on this computer. */
export function CloudGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { api } = useApp();
  const status = useAsync(() => api.cloud.status(), [api]);

  if (status.error) return <Notice kind="error">{status.error}</Notice>;
  if (!status.data) return <Notice>Loading…</Notice>;
  if (!status.data.configured) return <ConnectCloud feature={feature} />;
  return <>{children}</>;
}

/** First-time connection to the gym's Supabase project. Inside the desktop app it is a form; in a browser it explains the file. */
function ConnectCloud({ feature }: { feature: string }) {
  const save = window.neofit?.saveCloudConfig;
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!save) {
    return (
      <Notice>
        {feature} needs the cloud connection, which is not set up on this computer yet. Add the Supabase settings to the app's
        configuration file and restart the app (see <code>supabase/README.md</code>).
      </Notice>
    );
  }
  if (done) return <Notice kind="ok">Connected. The app is restarting…</Notice>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    const result = await save({ url, anonKey, ownerEmail, ownerPassword });
    if (result.ok) setDone(true);
    else setError(result.error);
    setBusy(false);
  };

  return (
    <form className="card form" onSubmit={submit}>
      <div>
        <h2>Connect to the cloud</h2>
        <p className="hint">
          {feature} needs the gym's Supabase project. Enter its details once; they are kept on this computer only. Use the owner account
          from <code>supabase/README.md</code> step 3. The app restarts when it is connected.
        </p>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <label className="field">
        <span>Project URL</span>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" autoComplete="off" required />
      </label>
      <label className="field">
        <span>Anon (public) key</span>
        <PasswordInput value={anonKey} onChange={(e) => setAnonKey(e.target.value)} autoComplete="off" required />
      </label>
      <label className="field">
        <span>Owner email</span>
        <input className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} autoComplete="off" required />
      </label>
      <label className="field">
        <span>Owner password</span>
        <PasswordInput value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} autoComplete="off" required />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? 'Checking…' : 'Connect'}</button>
    </form>
  );
}
