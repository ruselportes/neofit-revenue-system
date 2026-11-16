import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import logoImg from './assets/logo.png';
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

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Same icons and order as the NeoFit Admin desktop app.
const NAV: Array<{ view: ViewName; label: string; icon: ReactNode }> = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </Icon>
    ),
  },
  {
    view: 'members',
    label: 'Members',
    icon: (
      <Icon>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icon>
    ),
  },
  {
    view: 'rates',
    label: 'Rates',
    icon: (
      <Icon>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </Icon>
    ),
  },
  {
    view: 'revenue',
    label: 'Revenue',
    icon: (
      <Icon>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </Icon>
    ),
  },
  {
    view: 'logbook',
    label: 'Logbook',
    icon: (
      <Icon>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </Icon>
    ),
  },
];

export default function App() {
  const client = useMemo(() => new ApiClient(API_URL), []);
  const api = useMemo(() => new Api(client), [client]);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewName>('dashboard');
  const [openForm, setOpenForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('neofit-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('neofit-sidebar-collapsed', String(!c));
      } catch {
        // ignore
      }
      return !c;
    });

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
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-head">
            <button className="brand" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label="Toggle sidebar">
              <img src={logoImg} alt="NeoFit Fitness Gym" />
            </button>
          </div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <button
                key={n.view}
                aria-current={view === n.view ? 'page' : undefined}
                onClick={() => navigate(n.view)}
                title={collapsed ? n.label : undefined}
              >
                <span className="nav-icon">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <button className="foot-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'} title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}>
              <span className="nav-icon">
                {theme === 'dark' ? (
                  <Icon>
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </Icon>
                ) : (
                  <Icon>
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </Icon>
                )}
              </span>
              <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button className="foot-btn" onClick={signOut} title={collapsed ? `Sign out (${session.email})` : session.email}>
              <span className="nav-icon">
                <Icon>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </Icon>
              </span>
              <span className="nav-label">Sign out</span>
            </button>
            <div className="foot-note">v{window.neofit?.version ?? '1.0.0'}</div>
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
