import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCloudClient } from '../src/cloud/SupabaseCloud';

const creds = { url: 'https://example-project.supabase.co', anonKey: 'anon-key-for-test' };

/**
 * The packaged app runs the server on Electron's Node 20, which has no global WebSocket. Tests run on a newer Node
 * that has one, so it is removed here to behave like the packaged app. (This was the cause of "Something went wrong"
 * on every Logbook and Announcements call in the installed app.)
 */
describe('the Supabase client on a Node without a built-in WebSocket', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is what broke the installed app: the library alone refuses to start', () => {
    vi.stubGlobal('WebSocket', undefined);
    expect(() => createClient(creds.url, creds.anonKey)).toThrow(/native WebSocket not found/);
  });

  it('starts with the ws library supplied by createCloudClient', () => {
    vi.stubGlobal('WebSocket', undefined);
    expect(() => createCloudClient(creds)).not.toThrow();
  });
});
