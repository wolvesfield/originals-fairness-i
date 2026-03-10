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

    // Performance Optimization: Cache HMAC instance for the serverSeed
    // This avoids creating a new HMAC instance for every iteration/float generation
    const hmacTemplate = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);

    // Performance Optimization: Pre-allocate structures to avoid garbage collection
    // overhead inside the high-frequency loop.
    let cells: Uint8Array | undefined;
    let targetMap: Uint8Array | undefined;
    let drawnMap: Uint8Array | undefined;

    if (gameType === 'MINES') {
      const totalCells = gameConfig.totalCells ?? 25;
      cells = new Uint8Array(totalCells);
      targetMap = new Uint8Array(totalCells);
      for (const t of targetPattern) {
        if (t < totalCells) targetMap[t] = 1;
      }
    } else if (gameType === 'KENO') {
      const maxNum = gameConfig.maxNum ?? 40;
      drawnMap = new Uint8Array(maxNum + 1); // 1-indexed
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
          isGold = validateMinesState(hmacTemplate, clientSeed, nonce, targetMap!, cells!, mineCount, totalCells);
          break;
        }
        case 'KENO': {
          const drawCount = gameConfig.drawCount ?? 20;
          const maxNum = gameConfig.maxNum ?? 40;
          const minHits = gameConfig.minKenoHits ?? Math.ceil(targetPattern.length * 0.5);
          isGold = validateKenoState(hmacTemplate, clientSeed, nonce, targetPattern, drawnMap!, drawCount, maxNum, minHits);
          break;
        }
        case 'CRASH': {
          const targetMultiplier = gameConfig.targetMultiplier ?? 2.0;
          isGold = validateCrashState(hmacTemplate, clientSeed, nonce, targetMultiplier);
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
// Core crypto — matches fairnessEngine.ts exactly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optimized float generation using a pre-initialized HMAC template.
 * Extracts the hash word directly instead of converting to Hex string.
 */
function generateFloatOpt(hmacTemplate: any, clientSeed: string, nonce: number, cursor: number): number {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  const hmac = hmacTemplate.clone();
  hmac.update(message);
  const hash = hmac.finalize();
  // hash.words[0] contains the first 4 bytes. >>> 0 casts to unsigned 32-bit int.
  return (hash.words[0] >>> 0) / 4294967296;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mines — Fisher-Yates shuffle (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncated search: early-exit if any target tile is already in a mine swap
 * position BEFORE finishing all mineCount iterations. This avoids computing
 * all mine positions when we can already tell a target tile is mined.
 *
 * Optimized: Uses pre-allocated Uint8Arrays to prevent memory allocations.
 */
function validateMinesState(
  hmacTemplate: any, clientSeed: string, nonce: number,
  targetMap: Uint8Array, cells: Uint8Array, mineCount: number, totalCells: number
): boolean {
  for (let i = 0; i < totalCells; i++) {
    cells[i] = i;
  }
  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloatOpt(hmacTemplate, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));

    // Swap
    const temp = cells[i];
    cells[i] = cells[j];
    cells[j] = temp;

    // Truncated search: if this mine position is a target tile, fail early
    // Using O(1) array lookup instead of Set.has
    if (targetMap[cells[i]] === 1) {
      return false;
    }
  }

  return true; // No target tiles are mines
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Set-based collision avoidance (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Populates a pre-allocated drawnMap with Keno draws, returning the number
 * of matches (hits) against selectedNumbers.
 */
function validateKenoState(
  hmacTemplate: any, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawnMap: Uint8Array, drawCount: number, maxNum: number, minHits: number
): boolean {
  drawnMap.fill(0);
  let cursor = 0;
  let drawnSize = 0;

  while (drawnSize < drawCount) {
    const float = generateFloatOpt(hmacTemplate, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;
    if (drawnMap[num] === 0) {
      drawnMap[num] = 1;
      drawnSize++;
    }
  }

  let hits = 0;
  for (let i = 0; i < selectedNumbers.length; i++) {
    if (drawnMap[selectedNumbers[i]] === 1) {
      hits++;
    }
  }

  return hits >= minHits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crash — industry standard (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

function validateCrashState(
  hmacTemplate: any, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  const message = `${clientSeed}:${nonce}`;
  const hmac = hmacTemplate.clone();
  hmac.update(message);
  const hash = hmac.finalize().toString(CryptoJS.enc.Hex);

  const h = parseInt(hash.slice(0, 13), 16);

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
