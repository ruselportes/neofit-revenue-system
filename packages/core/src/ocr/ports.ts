import type { LogbookEntry } from '../domain';

/** A captured page. Base64 is loaded lazily because only the online engine needs it. */
export interface OcrImage {
  readonly uri: string;
  readonly mimeType: string;
  loadBase64(): Promise<string>;
}

/** A reader of logbook pages. Implementations are interchangeable (Strategy). */
export interface IOcrEngine {
  readonly name: string;
  /** True when each call uses a limited daily quota that the pipeline must count. */
  readonly quotaMetered: boolean;
  scan(image: OcrImage): Promise<LogbookEntry[]>;
}

/** Key-value storage (AsyncStorage on the phone, a Map in tests). */
export interface IKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface IClock {
  now(): Date;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface IHttpClient {
  postJson(url: string, body: unknown): Promise<HttpResponse>;
}

/** On-device text recognition (ML Kit). Returns the raw text of the page. */
export interface ITextRecognizer {
  recognize(imageUri: string): Promise<string>;
}
