import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from './api/ApiClient';
import { Api } from './api/resources';
import type { Session } from './api/types';
import { AppContext, applyTheme, loadTheme, messageOf, type Theme } from './state';
import DashboardView from './views/DashboardView';
import LoginView from './views/LoginView';
import LogbookView from './views/LogbookView';
import MembersView from './views/MembersView';
import RatesView from './views/RatesView';
import RevenueView from './views/RevenueView';

declare global {
  interface Window {
    /** Provided by the Electron preload script; absent in a plain browser. */
    neofit?: { version: string; apiUrl?: string };
  }
}

// The desktop shell tells the app which port the local API chose; a plain browser uses the default.
const API_URL = window.neofit?.apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

export type ViewName = 'dashboard' | 'members' | 'logbook' | 'rates' | 'revenue';
export interface Navigate {
  (view: ViewName, options?: { openForm?: boolean }): void;
}

const NAV: Array<{ view: ViewName; label: string }> = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'members', label: 'Members' },
  { view: 'logbook', label: 'Logbook' },
  { view: 'revenue', label: 'Revenue' },
  { view: 'rates', label: 'Rates' },
];

export default function App() {
  const client = useMemo(() => new ApiClient(API_URL), []);
  const api = useMemo(() => new Api(client), [client]);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewName>('dashboard');
  const [openForm, setOpenForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const signOut = useCallback(() => {
    client.setToken(null);
    setSession(null);
    setView('dashboard');
  }, [client]);

  useEffect(() => {
    client.onUnauthorized = signOut;
  }, [client, signOut]);

  useEffect(() => applyTheme(theme), [theme]);

  const signedIn = (s: Session) => {
    client.setToken(s.token);
    setSession(s);
  };

  const navigate: Navigate = (next, options) => {
    setOpenForm(options?.openForm ?? false);
    setView(next);
  };

  if (!session) return <LoginView api={api} onSignedIn={signedIn} />;

  return (
    <AppContext.Provider value={{ api, email: session.email, signOut }}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">N</span>
            NeoFit
          </div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <button key={n.view} aria-current={view === n.view ? 'page' : undefined} onClick={() => navigate(n.view)}>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="row">
              <span title={session.email}>Administrator</span>
              <button className="btn small" onClick={signOut}>Sign out</button>
            </div>
            <div className="row">
              <button className="btn small" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}>
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <span>v{window.neofit?.version ?? '1.0.0'}</span>
            </div>
          </div>
        </aside>
        <main className="main">
          {view === 'dashboard' && <DashboardView navigate={navigate} />}
          {view === 'members' && <MembersView autoOpenForm={openForm} />}
          {view === 'logbook' && <LogbookView />}
          {view === 'revenue' && <RevenueView />}
          {view === 'rates' && <RatesView />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

export { messageOf };
