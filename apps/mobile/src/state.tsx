import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList } from 'react';
import type { AuthState } from './services/AuthService';
import type { Services } from './services/Services';

const ServicesContext = createContext<Services | null>(null);
export const ServicesProvider = ServicesContext.Provider;

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesProvider.');
  return services;
}

/** The current sign-in state; it changes when the user signs in or out. */
export function useAuthState(): AuthState {
  const { auth } = useServices();
  const [state, setState] = useState<AuthState>(auth.current());
  useEffect(() => auth.subscribe(setState), [auth]);
  return state;
}

export interface AsyncState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => Promise<void>;
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** Runs the loader when the screen opens and when `deps` change. Late answers are ignored. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const data = await loaderRef.current();
      if (id === run.current) setState({ data, loading: false });
    } catch (err) {
      if (id === run.current) setState((s) => ({ data: s.data, loading: false, error: messageOf(err) }));
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load };
}
