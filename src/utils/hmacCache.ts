import CryptoJS from 'crypto-js';

// ---------------------------------------------------------------------------
// Optimization: Bounded LRU Cache for HMAC instances to prevent memory leaks
// while avoiding repeated heavy instantiations in ultra-high frequency tasks.
// ---------------------------------------------------------------------------
export class HMACCaching {
  private cache = new Map<string, any>();
  private maxSize = 100;

  get(serverSeed: string) {
    let inst = this.cache.get(serverSeed);
    if (inst) {
      // LRU bump
      this.cache.delete(serverSeed);
      this.cache.set(serverSeed, inst);
    } else {
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) this.cache.delete(firstKey);
      }
      inst = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
      this.cache.set(serverSeed, inst);
    }
    return inst;
  }
}

export const hmacCache = new HMACCaching();
