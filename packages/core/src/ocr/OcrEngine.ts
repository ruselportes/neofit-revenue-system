import type { LogbookEntry } from '../domain';
import type { IOcrEngine, OcrImage } from './ports';

/** Base class for engines. `scan` is the template: subclasses only supply `read`. */
export abstract class OcrEngine implements IOcrEngine {
  abstract readonly name: string;
  abstract readonly quotaMetered: boolean;

  async scan(image: OcrImage): Promise<LogbookEntry[]> {
    return this.read(image);
  }

  protected abstract read(image: OcrImage): Promise<LogbookEntry[]>;
}
