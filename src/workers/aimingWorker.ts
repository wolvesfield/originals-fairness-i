import CryptoJS from 'crypto-js';

/**
 * UHF Operational Brain — Enhanced for All Games
 * Uses IDENTICAL algorithms to fairnessEngine.ts (Fisher-Yates for Mines,
 * Set-based collision avoidance for Keno, industry-standard Crash formula).
 *
 * Supports:
 *  - SCAN_CHUNK: brute-force nonce scanning
 *  - Progress reporting via SharedArrayBuffer (Atomics)
 *  - Truncated search: early-exit heuristic for Mines
 */

/* ── Types ── */
interface ScanPayload {
  startNonce: number;
  endNonce: number;
  serverSeed: string;
  clientSeed: string;
  targetPattern: number[];
  gameType?: 'MINES' | 'KENO' | 'CRASH';
  gameConfig?: {
    mineCount?: number;
    totalCells?: number;
    drawCount?: number;
    maxNum?: number;
    targetMultiplier?: number;
    minKenoHits?: number;
  };
  progressBuffer?: SharedArrayBuffer; // Int32Array: [0]=scanned, [1]=found (0/1), [2]=foundNonce
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data as { type: string; payload: ScanPayload };

  if (type === 'SCAN_CHUNK') {
    const {
      startNonce, endNonce, serverSeed, clientSeed, targetPattern,
      gameType = 'MINES', gameConfig = {}, progressBuffer
    } = payload;

    // Optional SharedArrayBuffer for progress tracking
    let progress: Int32Array | null = null;
    if (progressBuffer) {
      progress = new Int32Array(progressBuffer);
    }

    for (let nonce = startNonce; nonce <= endNonce; nonce++) {
      // Check if another worker already found a result (kill-switch via Atomics)
      if (progress && Atomics.load(progress, 1) === 1) {
        self.postMessage({ found: false, earlyExit: true });
        return;
      }

      let isGold = false;

      switch (gameType) {
        case 'MINES': {
          const mineCount = gameConfig.mineCount ?? 3;
          const totalCells = gameConfig.totalCells ?? 25;
          isGold = validateMinesStateOptimized(serverSeed, clientSeed, nonce, targetPattern, mineCount, totalCells);
          break;
        }
        case 'KENO': {
          const drawCount = gameConfig.drawCount ?? 20;
          const maxNum = gameConfig.maxNum ?? 40;
          const minHits = gameConfig.minKenoHits ?? Math.ceil(targetPattern.length * 0.5);
          isGold = validateKenoStateOptimized(serverSeed, clientSeed, nonce, targetPattern, drawCount, maxNum, minHits);
          break;
        }
        case 'CRASH': {
          const targetMultiplier = gameConfig.targetMultiplier ?? 2.0;
          isGold = validateCrashStateOptimized(serverSeed, clientSeed, nonce, targetMultiplier);
          break;
        }
      }

      // Report progress
      if (progress) {
        Atomics.add(progress, 0, 1);
      }

      if (isGold) {
        // Signal found via Atomics so other workers can stop
        if (progress) {
          Atomics.store(progress, 1, 1);
          Atomics.store(progress, 2, nonce);
        }
        self.postMessage({ found: true, nonce, safePath: targetPattern });
        return;
      }
    }
    self.postMessage({ found: false });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Optimizations — High-Performance Variants (using direct word access and preallocation)
// ─────────────────────────────────────────────────────────────────────────────

// Cache a single HMAC-SHA256 instance per worker instead of instantiating it thousands of times per scan chunk.
// This is significantly faster because we just `.reset()` and `.update()` avoiding GC pressure.
let cachedHasher: any = null;
let currentServerSeed: string | null = null;

function getHasher(serverSeed: string) {
  if (currentServerSeed !== serverSeed || !cachedHasher) {
    cachedHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    currentServerSeed = serverSeed;
  }
  return cachedHasher;
}

// Reusable buffers for allocations that happen millions of times
const cellsBuffer = new Uint8Array(100); // Mines board up to 100 cells
const kenoBuffer = new Uint8Array(100); // Keno board up to 100 maxNum

/**
 * Highly optimized variant. Avoids `generateFloat` hex conversion overhead by using bitwise
 * shift on the internal `words` array. Preallocates Uint8Array instead of standard arrays.
 * ⚡ Bolt Optimization: Expected to improve Mines scan speed by ~3x to ~4x.
 */
function validateMinesStateOptimized(
  serverSeed: string, clientSeed: string, nonce: number,
  targetPattern: number[], mineCount: number, totalCells: number
): boolean {
  // Preallocate state and reuse
  for (let i = 0; i < totalCells; i++) {
    cellsBuffer[i] = i;
  }

  const hasher = getHasher(serverSeed);
  const prefix = `${clientSeed}:${nonce}:`;
  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    hasher.reset();
    hasher.update(prefix + cursor);
    const hash = hasher.finalize();
    // Direct word access to compute float in [0, 1). Avoids `.toString(Hex)` string allocations.
    const float = (hash.words[0] >>> 0) / 4294967296;

    cursor++;
    const j = Math.floor(float * (i + 1));

    // Swap
    const tmp = cellsBuffer[i];
    cellsBuffer[i] = cellsBuffer[j];
    cellsBuffer[j] = tmp;

    // Truncated search: check against target pattern early
    for (let k = 0; k < targetPattern.length; k++) {
      if (cellsBuffer[i] === targetPattern[k]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Highly optimized variant. Replaces `Set` with a preallocated `Uint8Array` to track draws.
 * ⚡ Bolt Optimization: Expected to improve Keno scan speed by ~2.5x to ~3x.
 */
function validateKenoStateOptimized(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  // Use preallocated buffer to track drawn numbers
  kenoBuffer.fill(0, 0, maxNum + 1);

  const hasher = getHasher(serverSeed);
  const prefix = `${clientSeed}:${nonce}:`;

  let size = 0;
  let cursor = 0;

  while (size < drawCount) {
    hasher.reset();
    hasher.update(prefix + cursor);
    const hash = hasher.finalize();
    // Direct word access
    const float = (hash.words[0] >>> 0) / 4294967296;

    cursor++;
    const num = Math.floor(float * maxNum) + 1;

    if (kenoBuffer[num] === 0) {
      kenoBuffer[num] = 1;
      size++;
    }
  }

  let hits = 0;
  for (let i = 0; i < selectedNumbers.length; i++) {
    if (kenoBuffer[selectedNumbers[i]] === 1) {
      hits++;
    }
  }

  return hits >= minHits;
}

/**
 * Highly optimized variant. Derives 52-bit crash integer using direct word bitwise operations,
 * bypassing `.slice(0, 13)` and `parseInt(..., 16)`.
 * ⚡ Bolt Optimization: Expected to improve Crash scan speed by ~2.5x to ~3x.
 */
function validateCrashStateOptimized(
  serverSeed: string, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  const hasher = getHasher(serverSeed);
  hasher.reset();
  hasher.update(`${clientSeed}:${nonce}`);

  const words = hasher.finalize().words;
  // First 13 hex characters = 52 bits.
  // word0 provides 32 bits (8 hex chars).
  // word1 provides the remaining 20 bits (5 hex chars), so shift right by 12.
  const word0 = words[0] >>> 0;
  const word1 = words[1] >>> 0;
  // h = word0 * 2^20 + (word1 >>> 12)
  const h = word0 * 1048576 + (word1 >>> 12);

  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = 4503599627370496; // Math.pow(2, 52)
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
