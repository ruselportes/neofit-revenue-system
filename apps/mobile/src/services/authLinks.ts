export interface LinkTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Reads the tokens from the sign-in link a member opens. Supabase puts them after "#"
 * (or after "?") in the address. Returns null for any other address.
 */
export function parseAuthUrl(url: string): LinkTokens | null {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const parts = [hash >= 0 ? url.slice(hash + 1) : '', query >= 0 ? url.slice(query + 1, hash >= 0 && hash > query ? hash : undefined) : ''];

  for (const part of parts) {
    if (!part) continue;
    const params = new URLSearchParams(part);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) return { accessToken, refreshToken };
  }
  return null;
}
