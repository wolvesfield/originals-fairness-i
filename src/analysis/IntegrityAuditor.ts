import crypto from 'crypto';

/**
 * Hashes.com API Integration + Local Dictionary
 * Transitions system from probabilistic to deterministic mode
 */
export class IntegrityAuditor {
  private hashesApiKey: string;
  private baseUrl = 'https://hashes.com/api/search';
  private localCache: Map<string, string> = new Map();

  constructor() {
    this.hashesApiKey = process.env.HASHES_API_KEY || '';
  }

  async resolveServerSeed(hash: string): Promise<string | null> {
    // 1. Check local cache (instant)
    const cached = this.localCache.get(hash);
    if (cached) return cached;

    // 2. Local dictionary check (<100ms)
    const localMatch = await this.checkLocalDictionary(hash);
    if (localMatch) {
      this.localCache.set(hash, localMatch);
      return localMatch;
    }

    // 3. Hashes.com API query (1-3s)
    if (!this.hashesApiKey) return null;
    try {
      const response = await fetch(`${this.baseUrl}?key=${this.hashesApiKey}&hash=${hash}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.result) {
        this.localCache.set(hash, data.result);
        return data.result;
      }
    } catch (error) {
      console.error('[DHSE] API connectivity error:', error);
    }

    return null;
  }

  private async checkLocalDictionary(hash: string): Promise<string | null> {
    // Placeholder: load from SQLite or flat file
    return null;
  }

  verifyHash(plaintext: string, expectedHash: string): boolean {
    const computed = crypto.createHash('sha256').update(plaintext).digest('hex');
    return computed === expectedHash.toLowerCase();
  }
}
