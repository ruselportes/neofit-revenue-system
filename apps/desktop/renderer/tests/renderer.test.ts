import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/api/ApiClient';
import { formatDate, formatPeso, percentText, shiftMonth } from '../src/format';

const reply = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('ApiClient', () => {
  it('sends the token as a bearer header and the body as JSON', async () => {
    const fetchMock = reply(200, { ok: true });
    const client = new ApiClient('http://x', fetchMock as unknown as typeof fetch);
    client.setToken('abc');
    await client.post('/api/thing', { a: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://x/api/thing');
    expect(init.headers).toMatchObject({ authorization: 'Bearer abc', 'content-type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
  });

  it('raises the API message as an ApiError', async () => {
    const client = new ApiClient('http://x', reply(400, { error: 'name is required.' }) as unknown as typeof fetch);
    await expect(client.get('/api/members')).rejects.toMatchObject({ message: 'name is required.', status: 400 });
  });

  it('clears the token and signals once when the API refuses it', async () => {
    const client = new ApiClient('http://x', reply(401, { error: 'Invalid or expired token.' }) as unknown as typeof fetch);
    const onUnauthorized = vi.fn();
    client.onUnauthorized = onUnauthorized;
    client.setToken('old');
    await expect(client.get('/api/members')).rejects.toBeInstanceOf(ApiError);
    await expect(client.get('/api/members')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not signal for a wrong password at sign-in (no token yet)', async () => {
    const client = new ApiClient('http://x', reply(401, { error: 'Invalid email or password.' }) as unknown as typeof fetch);
    const onUnauthorized = vi.fn();
    client.onUnauthorized = onUnauthorized;
    await expect(client.post('/api/login', {})).rejects.toMatchObject({ message: 'Invalid email or password.' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('explains when the server cannot be reached', async () => {
    const client = new ApiClient('http://x', (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    await expect(client.get('/api/members')).rejects.toMatchObject({ status: 0 });
  });

  it('returns nothing for 204', async () => {
    const client = new ApiClient('http://x', reply(204) as unknown as typeof fetch);
    await expect(client.delete('/api/members/1')).resolves.toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats pesos', () => {
    expect(formatPeso(1470)).toBe('₱1,470.00');
  });
  it('formats dates without a time-zone shift', () => {
    expect(formatDate('2026-11-04')).toBe('Nov 4, 2026');
    expect(formatDate(null)).toBe('—');
  });
  it('moves between months across the year', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 });
  });
  it('words the change', () => {
    expect(percentText(12.34)).toBe('+12.3%');
    expect(percentText(-5)).toBe('-5.0%');
    expect(percentText(null)).toBe('no earlier data');
  });
});

import { niceCeil } from '../src/components';

describe('niceCeil (chart axis)', () => {
  it.each([
    [0, 100],
    [700, 800],
    [1470, 2000],
    [5, 8],
    [2000, 2000],
    [12000, 20000],
  ])('%s -> %s', (value, top) => {
    expect(niceCeil(value)).toBe(top);
  });
});

describe('ApiClient.download', () => {
  it('returns the file as a Blob and sends the token', async () => {
    const fetchMock = vi.fn(async () => new Response('file-bytes', { status: 200 }));
    const client = new ApiClient('http://x', fetchMock as unknown as typeof fetch);
    client.setToken('abc');
    const file = await client.download('/api/revenue/report?year=2026&month=11');
    expect(await file.text()).toBe('file-bytes');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: 'Bearer abc' });
  });
  it('raises the server message when the download is refused', async () => {
    const client = new ApiClient('http://x', reply(400, { error: 'Invalid month.' }) as unknown as typeof fetch);
    await expect(client.download('/x')).rejects.toMatchObject({ message: 'Invalid month.', status: 400 });
  });
  it('signs out when the token is refused', async () => {
    const client = new ApiClient('http://x', reply(401, { error: 'Invalid or expired token.' }) as unknown as typeof fetch);
    const onUnauthorized = vi.fn();
    client.onUnauthorized = onUnauthorized;
    client.setToken('old');
    await expect(client.download('/x')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
