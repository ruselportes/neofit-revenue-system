import type { LogbookEntry } from '../domain';
import { OcrEngineError } from '../errors';
import { OcrEngine } from './OcrEngine';
import type { OcrParser } from './OcrParser';
import type { ITextRecognizer, OcrImage } from './ports';

/** Offline engine: ML Kit reads the text on the phone, then OcrParser structures it. */
export class MlKitOcrEngine extends OcrEngine {
  readonly name = 'ML Kit';
  readonly quotaMetered = false;

  constructor(
    private readonly recognizer: ITextRecognizer,
    private readonly parser: OcrParser,
  ) {
    super();
  }

  protected async read(image: OcrImage): Promise<LogbookEntry[]> {
    let text: string;
    try {
      text = await this.recognizer.recognize(image.uri);
    } catch (err) {
      throw new OcrEngineError(this.name, 'unavailable', err instanceof Error ? err.message : undefined);
    }
    return this.parser.parse(text);
  }
}
