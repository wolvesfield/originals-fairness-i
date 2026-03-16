import CryptoJS from 'crypto-js';

/**
 * HMACCaching - Bounded LRU Cache for HMAC instances.
 * Reusing an HMAC instance (via reset/update) is significantly faster and
 * produces less garbage than creating a new instance on every call.
 */
export class HMACCaching {
  private static CACHE_SIZE = 10;
  private static hmacCache = new Map<string, any>();
  private static keys: string[] = [];

  /**
   * Returns a ready-to-use HMAC instance for the given serverSeed.
   * If the seed is in the cache, the instance is returned (after calling .reset()).
   * If not, a new instance is created and cached.
   * Do NOT call reset() on the returned instance. Just call .update() and .finalize().
   * WARNING: The returned instance is shared. Callers MUST extract the hash immediately.
   */
  static getHmac(serverSeed: string) {
    let hmac = this.hmacCache.get(serverSeed);
    if (!hmac) {
      hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
      if (this.keys.length >= this.CACHE_SIZE) {
        const oldest = this.keys.shift()!;
        this.hmacCache.delete(oldest);
      }
      this.keys.push(serverSeed);
      this.hmacCache.set(serverSeed, hmac);
    } else {
      hmac.reset();
      // move to end (LRU)
      const idx = this.keys.indexOf(serverSeed);
      if (idx !== -1) {
        this.keys.splice(idx, 1);
        this.keys.push(serverSeed);
      }
    }
    return hmac;
  }
}
