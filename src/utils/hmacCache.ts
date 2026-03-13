import CryptoJS from 'crypto-js';

/**
 * Bounded LRU Cache for CryptoJS HMAC instances.
 * Prevents memory leaks and garbage collection overhead during high-frequency crypto operations.
 */
export class HMACCaching {
  private cache: Map<string, any>;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(serverSeed: string): any {
    let hmac = this.cache.get(serverSeed);
    if (hmac) {
      // Move to end for LRU behavior
      this.cache.delete(serverSeed);
      this.cache.set(serverSeed, hmac);
      return hmac;
    }

    hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    this.cache.set(serverSeed, hmac);

    if (this.cache.size > this.maxSize) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    return hmac;
  }
}

// Global shared instance for general use
export const globalHmacCache = new HMACCaching();
