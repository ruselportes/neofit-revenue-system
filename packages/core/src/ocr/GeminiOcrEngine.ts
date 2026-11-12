import { LogbookEntry, type RateBook } from '../domain';
import { OcrEngineError } from '../errors';
import { OcrEngine } from './OcrEngine';
import type { IHttpClient, OcrImage } from './ports';

export interface GeminiConfig {
  readonly apiKey: string;
  readonly model?: string;
}

/** Builds the instructions sent with the page image. */
export class GeminiPromptBuilder {
  constructor(private readonly rates: RateBook) {}

  build(): string {
    return `You are an expert OCR AI specialized in reading handwritten Philippine gym logbook payment lists.

1. The image may be rotated 90, 180 or 270 degrees. Read the text correctly regardless of orientation.
2. The page is usually a table (Name | Plan | Amount | Payment method). Read the NAME from the name column and the AMOUNT from the amount column. Do not put headers, dates or page numbers in the output.
3. Examples: "Dimple - 20 - G-Cash" -> name "Dimple", amount 20. "AJ - 20" -> name "AJ", amount 20. "Janice" -> name "Janice", amount null.
4. Remove payment tags ("G-Cash", "GCash", "Cash", "GC") from the name.
5. Remove row numbers ("1.", "2.") and ignore section titles such as "monthly / semi monthly" or "Daily".
6. Amounts are Philippine pesos. Common valid amounts: ${this.rates.validAmounts().join(', ')}. Never invent an amount. If a digit is unclear, return null.

Return ONLY valid JSON: an array, or an object { "entries": [...] }, of
{ "original_text": "raw line as written", "name": "Member Name", "amount": 20 }`;
  }
}

/** Online engine: Gemini reads the page image and returns JSON entries. */
export class GeminiOcrEngine extends OcrEngine {
  readonly name = 'Gemini';
  readonly quotaMetered = true;

  private readonly model: string;

  constructor(
    private readonly config: GeminiConfig,
    private readonly http: IHttpClient,
    private readonly prompts: GeminiPromptBuilder,
  ) {
    super();
    this.model = config.model ?? 'gemini-2.5-flash';
  }

  protected async read(image: OcrImage): Promise<LogbookEntry[]> {
    if (!this.config.apiKey) throw new OcrEngineError(this.name, 'no-key');

    const data = await image.loadBase64();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.config.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: this.prompts.build() }, { inline_data: { mime_type: image.mimeType, data } }] }],
      generationConfig: { temperature: 0.1, response_mime_type: 'application/json' },
    };

    let response;
    try {
      response = await this.http.postJson(url, body);
    } catch (err) {
      throw new OcrEngineError(this.name, 'http-error', err instanceof Error ? err.message : 'Network request failed.');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OcrEngineError(this.name, 'http-error', `HTTP ${response.status} ${text.slice(0, 300)}`.trim());
    }
    return this.toEntries(await this.readPayload(response));
  }

  private async readPayload(response: { json(): Promise<unknown> }): Promise<unknown> {
    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new OcrEngineError(this.name, 'bad-response', 'Invalid JSON response.');
    }
    const text: unknown = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text) throw new OcrEngineError(this.name, 'bad-response', 'No content.');
    try {
      return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
    } catch {
      throw new OcrEngineError(this.name, 'bad-response', 'Text was not valid JSON.');
    }
  }

  private toEntries(parsed: unknown): LogbookEntry[] {
    const obj = parsed as { entries?: unknown; data?: unknown } | null;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(obj?.entries)
        ? obj.entries
        : Array.isArray(obj?.data)
          ? obj.data
          : null;
    if (!list) throw new OcrEngineError(this.name, 'bad-response', 'No entries array.');

    return list.map((item: any) => {
      const name = String(item?.name ?? '').trim() || 'Unknown';
      return new LogbookEntry(name, this.toAmount(item?.amount), String(item?.original_text ?? name).trim());
    });
  }

  private toAmount(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (value == null) return null;
    const n = parseFloat(String(value).replace(/[₱P,\s]/gi, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
}
