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
          isGold = validateMinesState(serverSeed, clientSeed, nonce, targetPattern, mineCount, totalCells);
          break;
        }
        case 'KENO': {
          const drawCount = gameConfig.drawCount ?? 20;
          const maxNum = gameConfig.maxNum ?? 40;
          const minHits = gameConfig.minKenoHits ?? Math.ceil(targetPattern.length * 0.5);
          isGold = validateKenoState(serverSeed, clientSeed, nonce, targetPattern, drawCount, maxNum, minHits);
          break;
        }
        case 'CRASH': {
          const targetMultiplier = gameConfig.targetMultiplier ?? 2.0;
          isGold = validateCrashState(serverSeed, clientSeed, nonce, targetMultiplier);
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
// Core crypto — Optimized caching & Bitwise shifts
// ─────────────────────────────────────────────────────────────────────────────

let cachedHmac: any = null;
let cachedKey: string | null = null;

function ensureHmac(serverSeed: string) {
  if (cachedKey !== serverSeed) {
    cachedHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    cachedKey = serverSeed;
  }
}

/**
 * Generate Nth deterministic float using direct bitwise extraction.
 * Bypasses expensive hex string generation (.toString) and parseInt().
 */
function generateFloatFast(clientSeed: string, nonce: number, cursor: number): number {
  cachedHmac.reset();
  cachedHmac.update(`${clientSeed}:${nonce}:${cursor}`);
  const hash = cachedHmac.finalize();
  // Extract first 32-bit word directly and convert to float
  return (hash.words[0] >>> 0) / 4294967296;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mines — Highly Optimized Fisher-Yates
// ─────────────────────────────────────────────────────────────────────────────

// Pre-allocate arrays for UHF inner loop to eliminate GC churn
const cellsBuf = new Uint8Array(256);
const targetMapMines = new Uint8Array(256);

function validateMinesState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetPattern: number[], mineCount: number, totalCells: number
): boolean {
  ensureHmac(serverSeed);

  // Map targets onto pre-allocated typed array for O(1) checking
  targetMapMines.fill(0);
  for (let i = 0; i < targetPattern.length; i++) {
    targetMapMines[targetPattern[i]] = 1;
  }

  // Initialize cells inline
  for (let i = 0; i < totalCells; i++) {
    cellsBuf[i] = i;
  }

  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloatFast(clientSeed, nonce, cursor);
    cursor++;

    const j = Math.floor(float * (i + 1));

    // Inline swap
    const temp = cellsBuf[i];
    cellsBuf[i] = cellsBuf[j];
    cellsBuf[j] = temp;

    // Truncated search: early exit using pre-allocated map
    if (targetMapMines[cellsBuf[i]] === 1) {
      return false;
    }
  }

  return true; // No target tiles are mines
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Optimized Collision Tracking & Early Exit
// ─────────────────────────────────────────────────────────────────────────────

const drawnMapKeno = new Uint8Array(256);
const targetMapKeno = new Uint8Array(256);

function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  ensureHmac(serverSeed);

  drawnMapKeno.fill(0);
  targetMapKeno.fill(0);

  for (let i = 0; i < selectedNumbers.length; i++) {
    targetMapKeno[selectedNumbers[i]] = 1;
  }

  let drawnCount = 0;
  let cursor = 0;
  let hits = 0;

  while (drawnCount < drawCount) {
    const float = generateFloatFast(clientSeed, nonce, cursor);
    cursor++;

    const num = Math.floor(float * maxNum) + 1;

    if (drawnMapKeno[num] === 0) {
      drawnMapKeno[num] = 1;
      drawnCount++;

      if (targetMapKeno[num] === 1) {
        hits++;
        if (hits >= minHits) {
          return true; // Met condition, early exit
        }
      }
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crash — Optimized Bitwise Math
// ─────────────────────────────────────────────────────────────────────────────

function validateCrashState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  ensureHmac(serverSeed);

  cachedHmac.reset();
  cachedHmac.update(`${clientSeed}:${nonce}`);
  const hash = cachedHmac.finalize();

  // Extract the first 52 bits directly from words array without stringifying
  const w0 = hash.words[0] >>> 0;
  const w1 = hash.words[1] >>> 0;

  // Combine to create an integer from the first 13 hex characters (52 bits)
  // Shift w0 by 20 bits (multiply by 2^20 to avoid bitwise operator overflow limitations)
  const h = w0 * 1048576 + (w1 >>> 12);

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
