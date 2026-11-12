export interface SecureBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Secure Store limits the size of one value (about 2 KB), and a Supabase session is larger.
 * This keeps a long value in several small pieces. Pieces are written before the count, so a
 * write that is cut short is never read back as a damaged session.
 */
export class ChunkedSecureStorage {
  constructor(
    private readonly backend: SecureBackend,
    private readonly chunkSize = 1800,
  ) {}

  async getItem(key: string): Promise<string | null> {
    const count = Number(await this.backend.getItemAsync(this.countKey(key)));
    if (!Number.isInteger(count) || count < 1) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await this.backend.getItemAsync(this.partKey(key, i));
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  }

  async setItem(key: string, value: string): Promise<void> {
    const previous = Number(await this.backend.getItemAsync(this.countKey(key))) || 0;
    const parts = value.match(new RegExp(`[\\s\\S]{1,${this.chunkSize}}`, 'g')) ?? [''];
    for (let i = 0; i < parts.length; i++) await this.backend.setItemAsync(this.partKey(key, i), parts[i]!);
    await this.backend.setItemAsync(this.countKey(key), String(parts.length));
    for (let i = parts.length; i < previous; i++) await this.backend.deleteItemAsync(this.partKey(key, i));
  }

  async removeItem(key: string): Promise<void> {
    const count = Number(await this.backend.getItemAsync(this.countKey(key))) || 0;
    await this.backend.deleteItemAsync(this.countKey(key));
    for (let i = 0; i < count; i++) await this.backend.deleteItemAsync(this.partKey(key, i));
  }

  // Secure Store keys may only contain letters, digits, ".", "-" and "_".
  private safe(key: string): string {
    return key.replace(/[^A-Za-z0-9._-]/g, '_');
  }
  private countKey(key: string): string {
    return `${this.safe(key)}.n`;
  }
  private partKey(key: string, i: number): string {
    return `${this.safe(key)}.${i}`;
  }
}
