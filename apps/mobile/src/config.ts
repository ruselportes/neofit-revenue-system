export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Empty means online reading is off and every page is read on the phone. */
  geminiApiKey: string;
}

export class ConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`The app is not configured. Missing: ${missing.join(', ')}.`);
    this.name = 'ConfigError';
  }
}

/** Checks the values; returns the config or throws ConfigError listing what is missing. */
export function parseConfig(values: { url?: string; anonKey?: string; geminiKey?: string }): AppConfig {
  const missing: string[] = [];
  const url = (values.url ?? '').trim().replace(/\/+$/, '');
  const anonKey = (values.anonKey ?? '').trim();
  if (!url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!anonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length > 0) throw new ConfigError(missing);
  if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(url)) {
    throw new ConfigError(['EXPO_PUBLIC_SUPABASE_URL (must start with https://)']);
  }
  return { supabaseUrl: url, supabaseAnonKey: anonKey, geminiApiKey: (values.geminiKey ?? '').trim() };
}

/** Expo replaces `process.env.EXPO_PUBLIC_*` only where it is written out in full, so each name is spelled here. */
export function loadConfig(): AppConfig {
  return parseConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    geminiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  });
}
