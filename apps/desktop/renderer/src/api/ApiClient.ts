/** An error answer from the local API, or a failure to reach it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Fetch = typeof fetch;

/**
 * Sends requests to the local API. The token is kept in memory only, so closing the app
 * signs the administrator out. When the API refuses the token, `onUnauthorized` runs once
 * so the app can go back to the Login view.
 */
export class ApiClient {
  private token: string | null = null;
  onUnauthorized: () => void = () => undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body ?? {});
  }
  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }
  delete(path: string): Promise<void> {
    return this.request<void>('DELETE', path);
  }

  /** Fetches a file (for example the Word report). A refusal comes back as an ApiError with the server's message. */
  async download(path: string): Promise<Blob> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, { headers: this.token ? { authorization: `Bearer ${this.token}` } : {} });
    } catch {
      throw new ApiError('Cannot reach the local server. Is the app still running?', 0);
    }
    if (!res.ok) {
      const data: unknown = await res.json().catch(() => undefined);
      if (res.status === 401 && this.token) {
        this.token = null;
        this.onUnauthorized();
      }
      throw new ApiError((data as { error?: string } | undefined)?.error ?? `Request failed (${res.status}).`, res.status);
    }
    return res.blob();
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Cannot reach the local server. Is the app still running?', 0);
    }

    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = (data as { error?: string } | undefined)?.error ?? `Request failed (${res.status}).`;
      if (res.status === 401 && this.token) {
        this.token = null;
        this.onUnauthorized();
      }
      throw new ApiError(message, res.status);
    }
    return data as T;
  }
}
