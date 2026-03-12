import CryptoJS from 'crypto-js';

/**
 * A bounded LRU cache for HMAC-SHA256 instances.
 * Instantiating CryptoJS.algo.HMAC.create(...) is relatively expensive and can cause memory leaks
 * in long-running processes if stored indefinitely. This cache bounds the memory usage while
 * preserving the performance benefits of re-using HMAC state for hot paths.
 */
export class HMACCaching {
  private cache = new Map<string, any>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Retrieves an existing HMAC instance for the given serverSeed or creates a new one.
   * Modifies cache to maintain LRU order.
   */
  get(serverSeed: string): any {
    if (this.cache.has(serverSeed)) {
      const hmac = this.cache.get(serverSeed);
      // Move to end to maintain LRU (Most Recently Used)
      this.cache.delete(serverSeed);
      this.cache.set(serverSeed, hmac);
      return hmac;
    }

    // Create a new HMAC instance
    const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    this.cache.set(serverSeed, hmac);

    // Evict oldest (Least Recently Used) if we exceed maxSize
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    return hmac;
  }
}

// Global shared cache instance
export const globalHmacCache = new HMACCaching(100);
