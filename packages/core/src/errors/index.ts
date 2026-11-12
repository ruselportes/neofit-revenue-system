/** Root of every error the application raises on purpose. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A value object or entity was built with data that breaks its rules. */
export class ValidationError extends DomainError {}

export type OcrFailureReason =
  | 'no-key'
  | 'quota-exhausted'
  | 'unavailable'
  | 'http-error'
  | 'bad-response';

/** One OCR engine could not read the page. The pipeline catches this and tries the next engine. */
export class OcrEngineError extends DomainError {
  constructor(
    readonly engine: string,
    readonly reason: OcrFailureReason,
    detail?: string,
  ) {
    super(`${engine} failed (${reason})${detail ? `: ${detail}` : ''}`);
  }
}

/** Every OCR engine failed, so the user must type the page by hand. */
export class AllEnginesFailedError extends DomainError {
  constructor(readonly failures: readonly OcrEngineError[]) {
    super(`All OCR engines failed: ${failures.map((f) => f.message).join('; ')}`);
  }
}
