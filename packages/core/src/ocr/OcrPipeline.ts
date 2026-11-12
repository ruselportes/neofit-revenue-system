import type { LogbookEntry } from '../domain';
import { AllEnginesFailedError, OcrEngineError } from '../errors';
import type { IOcrEngine, OcrImage } from './ports';
import type { ScanLimiter } from './ScanLimiter';

export interface ScanResult {
  readonly entries: LogbookEntry[];
  /** Name of the engine that read the page. */
  readonly engine: string;
  /** Engines that were tried first and failed. */
  readonly skipped: readonly OcrEngineError[];
}

/**
 * Chain of responsibility: tries the engines in order and returns the first success.
 * A quota-metered engine is skipped when the daily limit is used up, and every attempt
 * on it counts against the limit.
 */
export class OcrPipeline {
  constructor(
    private readonly engines: readonly IOcrEngine[],
    private readonly limiter: ScanLimiter,
  ) {}

  async scan(image: OcrImage): Promise<ScanResult> {
    const failures: OcrEngineError[] = [];

    for (const engine of this.engines) {
      if (engine.quotaMetered) {
        if (!(await this.limiter.canScan())) {
          failures.push(new OcrEngineError(engine.name, 'quota-exhausted'));
          continue;
        }
        await this.limiter.consume();
      }
      try {
        const entries = await engine.scan(image);
        return { entries, engine: engine.name, skipped: failures };
      } catch (err) {
        failures.push(
          err instanceof OcrEngineError
            ? err
            : new OcrEngineError(engine.name, 'unavailable', err instanceof Error ? err.message : undefined),
        );
      }
    }
    throw new AllEnginesFailedError(failures);
  }
}
