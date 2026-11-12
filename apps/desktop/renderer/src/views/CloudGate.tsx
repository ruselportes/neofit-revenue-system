import type { ReactNode } from 'react';
import { Notice } from '../components';
import { useApp, useAsync } from '../state';

/** Shows its content only when the cloud connection is set up on this computer. */
export function CloudGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { api } = useApp();
  const status = useAsync(() => api.cloud.status(), [api]);

  if (status.error) return <Notice kind="error">{status.error}</Notice>;
  if (!status.data) return <Notice>Loading…</Notice>;
  if (!status.data.configured) {
    return (
      <Notice>
        {feature} needs the cloud connection, which is not set up on this computer yet. Add the Supabase settings to the app's
        configuration file and restart the app (see <code>supabase/README.md</code>).
      </Notice>
    );
  }
  return <>{children}</>;
}
