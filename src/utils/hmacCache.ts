import CryptoJS from 'crypto-js';

/**
 * Bounded LRU Cache for HMAC instances.
 * Prevents memory leaks and garbage collection overhead during high-frequency operations.
 */
export class HMACCaching {
  private limit: number;
  private map: Map<string, any>;

  constructor(limit: number = 100) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key: string): any | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key);
    // Refresh position to mark as recently used
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: string, val: any): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      // Evict oldest (first inserted) item
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, val);
  }

  /**
   * Helper to retrieve or create an HMAC instance for a given serverSeed.
   */
  getOrHmac(serverSeed: string): any {
    let hmac = this.get(serverSeed);
    if (!hmac) {
      hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
      this.set(serverSeed, hmac);
    }
    return hmac;
  }
}

// Export a singleton instance for global use
export const hmacCache = new HMACCaching();
