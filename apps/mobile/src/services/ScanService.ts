import {
  AllEnginesFailedError,
  GeminiOcrEngine,
  GeminiPromptBuilder,
  MlKitOcrEngine,
  OcrParser,
  OcrPipeline,
  RateBook,
  RateValidator,
  ReviewSession,
  ScanLimiter,
  type IOcrEngine,
  type ScanResult,
} from '@neofit/core';
import type { AppConfig } from '../config';
import { AsyncStorageStore, FetchHttpClient, MlKitRecognizer, prepareImage } from '../platform/adapters';

export interface ScanOutcome {
  /** The page ready to review. */
  session: ReviewSession;
  /** Name of the engine that read it: "Gemini" or "ML Kit". */
  engine: string;
  /** True when the page was read on the phone because the online reader could not be used. */
  usedFallback: boolean;
  /** Why the online reader was skipped, if it was. */
  reason: string | null;
}

/**
 * Reads a page: Gemini first, ML Kit when Gemini cannot be used (no connection, an error, a time-out
 * or the five scans of the day used up). The result is a proposal only: the user reviews it.
 */
export class ScanService {
  readonly limiter: ScanLimiter;
  readonly validator: RateValidator;
  private readonly pipeline: OcrPipeline;

  constructor(config: AppConfig, rates: RateBook = RateBook.neofitDefault()) {
    this.validator = new RateValidator(rates);
    this.limiter = new ScanLimiter(new AsyncStorageStore());

    const engines: IOcrEngine[] = [];
    if (config.geminiApiKey) {
      engines.push(new GeminiOcrEngine({ apiKey: config.geminiApiKey }, new FetchHttpClient(), new GeminiPromptBuilder(rates)));
    }
    engines.push(new MlKitOcrEngine(new MlKitRecognizer(), new OcrParser()));
    this.pipeline = new OcrPipeline(engines, this.limiter);
  }

  async scan(imageUri: string, date: string): Promise<ScanOutcome> {
    const image = await prepareImage(imageUri);
    let result: ScanResult;
    try {
      result = await this.pipeline.scan(image);
    } catch (err) {
      if (err instanceof AllEnginesFailedError) {
        // Nothing could read the page: the user types it in on the Review screen.
        return { session: ReviewSession.start(date, 'Manual', [], this.validator), engine: 'Manual', usedFallback: true, reason: 'The page could not be read.' };
      }
      throw err;
    }
    const skipped = result.skipped[0];
    return {
      session: ReviewSession.start(date, result.engine, result.entries, this.validator),
      engine: result.engine,
      usedFallback: skipped !== undefined,
      reason: skipped ? describeFailure(skipped.reason) : null,
    };
  }
}

function describeFailure(reason: string): string {
  switch (reason) {
    case 'quota-exhausted':
      return 'The online scans for today are used up.';
    case 'no-key':
      return 'Online reading is not set up.';
    default:
      return 'Online reading was not available.';
  }
}
