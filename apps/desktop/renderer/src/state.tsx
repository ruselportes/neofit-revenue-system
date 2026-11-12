import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList } from 'react';
import { Api } from './api/resources';

export interface AppServices {
  api: Api;
  email: string;
  signOut: () => void;
}

export const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside the signed-in app.');
  return ctx;
}

export interface AsyncState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** Runs a loader when the app first shows and whenever `deps` change. Late answers are ignored. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loaderRef.current().then(
      (data) => current && setState({ data, loading: false }),
      (err: unknown) => current && setState((s) => ({ data: s.data, loading: false, error: messageOf(err) })),
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export type Theme = 'light' | 'dark';

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem('neofit-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage can be unavailable
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('neofit-theme', theme);
  } catch {
    // ignore
  }
}
