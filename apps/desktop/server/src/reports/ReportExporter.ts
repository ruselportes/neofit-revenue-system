/**
 * Template method: every export checks its data, then renders a file. Subclasses supply the format
 * (today only Word) and say what the file is called and what type it has.
 */
export abstract class ReportExporter<TData> {
  abstract readonly extension: string;
  abstract readonly contentType: string;

  async export(data: TData, generatedAt: Date): Promise<Buffer> {
    this.validate(data);
    return this.render(data, generatedAt);
  }

  fileName(label: string): string {
    return `NeoFit-${label}.${this.extension}`;
  }

  protected validate(_data: TData): void {}

  protected abstract render(data: TData, generatedAt: Date): Promise<Buffer>;
}
