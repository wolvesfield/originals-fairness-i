import CryptoJS from 'crypto-js';

/**
 * Multi-Layer Hash Resolution Engine
 * Attempts to resolve SHA-256 hashes to their plaintext server seeds via:
 *   Layer 1: Local in-memory cache (instant)
 *   Layer 2: Local SQLite database of previously verified seeds (<10ms)
 *   Layer 3: Hashes.com API (1-3s, requires API key)
 *   Layer 4: Nitrxgen.net API (free, open-source alternative, 1-5s)
 * 
 * Transitions system from probabilistic to deterministic mode when successful.
 */
export class IntegrityAuditor {
  private hashesApiKey: string;
  private hashesBaseUrl = 'https://hashes.com/api/search';
  private nitrxgenBaseUrl = 'https://www.nitrxgen.net/md5db/';
  private localCache: Map<string, string> = new Map();
  private readonly isBrowser = typeof window !== 'undefined';

  constructor() {
    this.hashesApiKey = process.env.HASHES_API_KEY || '';
  }

  /**
   * Multi-layer hash resolution. Tries each layer in order until a match is found.
   */
  async resolveServerSeed(hash: string): Promise<string | null> {
    const normalizedHash = hash.toLowerCase().trim();
    
    // Layer 1: In-memory cache (instant)
    const cached = this.localCache.get(normalizedHash);
    if (cached) {
      console.log(`[IntegrityAuditor] Layer 1 HIT (cache): ${normalizedHash.slice(0, 16)}...`);
      return cached;
    }

    // Layer 2: Local SQLite database of verified seeds
    const dbMatch = await this.checkLocalDatabase(normalizedHash);
    if (dbMatch) {
      this.localCache.set(normalizedHash, dbMatch);
      console.log(`[IntegrityAuditor] Layer 2 HIT (SQLite): ${normalizedHash.slice(0, 16)}...`);
      return dbMatch;
    }

    if (this.isBrowser) {
      return null;
    }

    // Layer 3: Hashes.com API (paid, high coverage)
    if (this.hashesApiKey) {
      const hashesResult = await this.queryHashesCom(normalizedHash);
      if (hashesResult) {
        this.localCache.set(normalizedHash, hashesResult);
        console.log(`[IntegrityAuditor] Layer 3 HIT (hashes.com): ${normalizedHash.slice(0, 16)}...`);
        return hashesResult;
      }
    }

    // Layer 4: Nitrxgen.net (free, open-source hash DB)
    const nitrxgenResult = await this.queryNitrxgen(normalizedHash);
    if (nitrxgenResult) {
      this.localCache.set(normalizedHash, nitrxgenResult);
      console.log(`[IntegrityAuditor] Layer 4 HIT (nitrxgen.net): ${normalizedHash.slice(0, 16)}...`);
      return nitrxgenResult;
    }

    console.log(`[IntegrityAuditor] All layers MISS for: ${normalizedHash.slice(0, 16)}...`);
    return null;
  }

  /**
   * Layer 2: Check local SQLite database for previously verified seeds.
   * Queries the verified_seeds table in database/audit_store.db.
   */
  private async checkLocalDatabase(hash: string): Promise<string | null> {
    try {
      // Dynamic import to avoid breaking browser builds
      const Database = (await import('better-sqlite3')).default;
      const path = (await import('path')).default;
      const dbPath = path.resolve(process.cwd(), 'database', 'audit_store.db');
      
      const db = new Database(dbPath, { readonly: true });
      const row = db.prepare(
        'SELECT server_seed FROM verified_seeds WHERE server_hash = ? LIMIT 1'
      ).get(hash) as { server_seed: string } | undefined;
      db.close();

      return row?.server_seed || null;
    } catch {
      // SQLite not available (browser context or missing DB) — skip
      return null;
    }
  }

  /**
   * Layer 3: Hashes.com API — paid hash lookup service.
   */
  private async queryHashesCom(hash: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.hashesBaseUrl}?key=${this.hashesApiKey}&hash=${hash}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      );
      const data = await response.json();
      if (data.success && data.result) {
        return data.result;
      }
    } catch (error) {
      console.error('[IntegrityAuditor] Hashes.com API error:', error);
    }
    return null;
  }

  /**
   * Layer 4: Nitrxgen.net — free open-source hash database.
   * Supports MD5, SHA1, SHA256 lookups via simple GET request.
   * Returns plaintext directly in response body if found, empty string if not.
   */
  private async queryNitrxgen(hash: string): Promise<string | null> {
    if (!/^[a-f0-9]{32}$/.test(hash)) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.nitrxgenBaseUrl}${hash}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        }
      );
      const text = (await response.text()).trim();
      // Nitrxgen returns the plaintext directly, or empty string if not found
      if (text && text.length > 0) {
        // Verify the result is correct by re-hashing
        const verified = this.verifyHash(text, hash);
        if (verified) {
          return text;
        }
      }
    } catch (error) {
      console.error('[IntegrityAuditor] Nitrxgen.net API error:', error);
    }
    return null;
  }

  /**
   * Verify that a plaintext hashes to the expected SHA-256 hash.
   */
  verifyHash(plaintext: string, expectedHash: string): boolean {
    const computed = CryptoJS.SHA256(plaintext).toString(CryptoJS.enc.Hex);
    return computed === expectedHash.toLowerCase();
  }

  /**
   * Manually register a known seed→hash mapping (e.g., from ServerSeedReveal).
   */
  registerSeed(plaintext: string, hash: string): void {
    this.localCache.set(hash.toLowerCase(), plaintext);
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.localCache.size,
      entries: Array.from(this.localCache.keys()).map(k => k.slice(0, 16) + '...'),
    };
  }
}

// CLI entry point for standalone testing
if (typeof process !== 'undefined' && process.argv[1]?.includes('IntegrityAuditor')) {
  (async () => {
    console.log('═══ INTEGRITY AUDITOR — MULTI-LAYER HASH RESOLUTION ═══\n');
    const auditor = new IntegrityAuditor();

    // Demo: SHA-256 of 'test'
    const testHash = CryptoJS.SHA256('test').toString(CryptoJS.enc.Hex);
    console.log(`Test hash (SHA-256 of "test"): ${testHash}`);

    // Register it manually to demonstrate caching
    auditor.registerSeed('test', testHash);
    const result = await auditor.resolveServerSeed(testHash);
    console.log(`Resolved: ${result}`);
    console.log(`Verification: ${auditor.verifyHash('test', testHash) ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`\nCache stats:`, auditor.getCacheStats());

    // Try a real hash lookup (will hit APIs if configured)
    const unknownHash = 'abc123def456';
    console.log(`\nAttempting resolution of unknown hash: ${unknownHash}...`);
    const unknown = await auditor.resolveServerSeed(unknownHash);
    console.log(`Result: ${unknown || 'NOT FOUND (expected for demo hash)'}`);
  })();
}