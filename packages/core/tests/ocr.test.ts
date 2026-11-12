import { describe, expect, it } from 'vitest';
import {
  AllEnginesFailedError,
  GeminiOcrEngine,
  GeminiPromptBuilder,
  type IClock,
  type IHttpClient,
  type IKeyValueStore,
  type IOcrEngine,
  LogbookEntry,
  MlKitOcrEngine,
  OcrEngineError,
  OcrParser,
  type OcrImage,
  OcrPipeline,
  RateBook,
  RateValidator,
  ScanLimiter,
} from '../src';

class MemoryStore implements IKeyValueStore {
  private data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

class FixedClock implements IClock {
  constructor(public date: Date) {}
  now() {
    return this.date;
  }
}

const image: OcrImage = { uri: 'file://page.jpg', mimeType: 'image/jpeg', loadBase64: async () => 'AAAA' };
const rates = RateBook.neofitDefault();

describe('OcrParser', () => {
  const parser = new OcrParser();

  it('reads names and amounts and strips payment tags', () => {
    const [a, b, c] = parser.parse('1. Dimple - 20 - G-Cash\nAJ 20\nJanice');
    expect([a?.name, a?.amount?.pesos]).toEqual(['Dimple', 20]);
    expect([b?.name, b?.amount?.pesos]).toEqual(['Aj', 20]);
    expect([c?.name, c?.amount]).toEqual(['Janice', null]);
  });
  it('fixes letter-for-digit misreads', () => {
    expect(parser.parse('Maria - 1O0')[0]?.amount?.pesos).toBe(100);
  });
  it('flags repeated name and amount', () => {
    const entries = parser.parse('Rose - 90\nRose - 90\nRose - 70');
    expect(entries.map((e) => e.isDuplicate)).toEqual([true, true, false]);
  });
});

describe('RateValidator', () => {
  it('flags unofficial, missing and duplicate lines', () => {
    const validator = new RateValidator(rates);
    expect(validator.review(new LogbookEntry('A', 75)).issues).toEqual(['unofficial-amount']);
    expect(validator.review(new LogbookEntry('B', null)).issues).toEqual(['missing-amount']);
    expect(validator.review(new LogbookEntry('C', 70)).issues).toEqual([]);
  });
});

describe('ScanLimiter', () => {
  it('allows five scans, then blocks, and resets at 8:00 AM', async () => {
    const clock = new FixedClock(new Date(2026, 10, 4, 9, 0));
    const limiter = new ScanLimiter(new MemoryStore(), clock);
    for (let i = 0; i < 5; i++) await limiter.consume();
    expect(await limiter.canScan()).toBe(false);

    clock.date = new Date(2026, 10, 5, 7, 59); // still the same counting day
    expect(await limiter.canScan()).toBe(false);
    clock.date = new Date(2026, 10, 5, 8, 0); // new day
    expect((await limiter.usage()).remaining).toBe(5);
  });
  it('formats the reset time', () => {
    expect(new ScanLimiter(new MemoryStore()).formatResetTime()).toBe('8:00 AM');
  });
});

function geminiWith(reply: unknown, ok = true): GeminiOcrEngine {
  const http: IHttpClient = {
    postJson: async () => ({
      ok,
      status: ok ? 200 : 500,
      json: async () => reply,
      text: async () => 'server error',
    }),
  };
  return new GeminiOcrEngine({ apiKey: 'key' }, http, new GeminiPromptBuilder(rates));
}

const geminiReply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe('GeminiOcrEngine', () => {
  it('reads an entries array wrapped in a code fence', async () => {
    const engine = geminiWith(geminiReply('```json\n{"entries":[{"name":"Ian","amount":"₱450"}]}\n```'));
    const [entry] = await engine.scan(image);
    expect([entry?.name, entry?.amount?.pesos]).toEqual(['Ian', 450]);
  });
  it('fails with bad-response on non-JSON text', async () => {
    await expect(geminiWith(geminiReply('nope')).scan(image)).rejects.toMatchObject({ reason: 'bad-response' });
  });
  it('fails with http-error on a bad status', async () => {
    await expect(geminiWith({}, false).scan(image)).rejects.toMatchObject({ reason: 'http-error' });
  });
  it('fails with no-key when the key is empty', async () => {
    const engine = new GeminiOcrEngine({ apiKey: '' }, { postJson: async () => { throw new Error('x'); } }, new GeminiPromptBuilder(rates));
    await expect(engine.scan(image)).rejects.toBeInstanceOf(OcrEngineError);
  });
});

describe('OcrPipeline', () => {
  const mlKit = new MlKitOcrEngine({ recognize: async () => 'Rose - 90' }, new OcrParser());
  const failingGemini: IOcrEngine = {
    name: 'Gemini',
    quotaMetered: true,
    scan: async () => {
      throw new OcrEngineError('Gemini', 'http-error');
    },
  };

  it('falls back to ML Kit when Gemini fails, and counts the attempt', async () => {
    const limiter = new ScanLimiter(new MemoryStore());
    const result = await new OcrPipeline([failingGemini, mlKit], limiter).scan(image);
    expect(result.engine).toBe('ML Kit');
    expect(result.skipped[0]?.reason).toBe('http-error');
    expect((await limiter.usage()).used).toBe(1);
  });
  it('skips Gemini when the daily limit is used up', async () => {
    const limiter = new ScanLimiter(new MemoryStore());
    for (let i = 0; i < 5; i++) await limiter.consume();
    let called = false;
    const gemini: IOcrEngine = { name: 'Gemini', quotaMetered: true, scan: async () => { called = true; return []; } };
    const result = await new OcrPipeline([gemini, mlKit], limiter).scan(image);
    expect(called).toBe(false);
    expect(result.skipped[0]?.reason).toBe('quota-exhausted');
  });
  it('throws when every engine fails', async () => {
    const limiter = new ScanLimiter(new MemoryStore());
    const brokenMlKit = new MlKitOcrEngine({ recognize: async () => { throw new Error('boom'); } }, new OcrParser());
    await expect(new OcrPipeline([failingGemini, brokenMlKit], limiter).scan(image)).rejects.toBeInstanceOf(
      AllEnginesFailedError,
    );
  });
});
