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
// Core crypto — matches fairnessEngine.ts exactly
// ─────────────────────────────────────────────────────────────────────────────

// Single-value cache for HMAC instance to prevent memory leaks and optimize hot paths
let lastSeed: string | null = null;
let hmacCache: any = null;

/**
 * HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:cursor)
 */
function hmacSha256(serverSeed: string, clientSeed: string, nonce: number, cursor: number): string {
  const message = `${clientSeed}:${nonce}:${cursor}`;

  if (serverSeed !== lastSeed || !hmacCache) {
    lastSeed = serverSeed;
    hmacCache = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
  } else {
    hmacCache.reset();
  }

  hmacCache.update(message);
  return hmacCache.finalize().toString(CryptoJS.enc.Hex);
}

/**
 * Convert first 4 bytes (8 hex chars) to float in [0, 1).
 * int(first_8_hex) / 2^32
 */
function hashToFloat(hash: string): number {
  const slice = hash.slice(0, 8);
  const int = parseInt(slice, 16);
  return int / 4294967296;
}

/**
 * Generate Nth deterministic float for a given round.
 */
function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const message = `${clientSeed}:${nonce}:${cursor}`;

  if (serverSeed !== lastSeed || !hmacCache) {
    lastSeed = serverSeed;
    hmacCache = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
  } else {
    hmacCache.reset();
  }

  hmacCache.update(message);
  const hash = hmacCache.finalize();

  // Convert first 4 bytes to float in [0, 1) using bitwise operations
  return (hash.words[0] >>> 0) / 4294967296;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mines — Fisher-Yates shuffle (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns mineCount unique cell indices using Fisher-Yates shuffle.
 * Consumes one float per swap via incrementing cursor.
 */
function generateMinePositions(
  serverSeed: string, clientSeed: string, nonce: number,
  mineCount: number, totalCells: number
): number[] {
  const cells: number[] = Array.from({ length: totalCells }, (_, i) => i);
  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(totalCells - mineCount);
}

/**
 * Truncated search: early-exit if any target tile is already in a mine swap
 * position BEFORE finishing all mineCount iterations. This avoids computing
 * all mine positions when we can already tell a target tile is mined.
 */
function validateMinesState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetPattern: number[], mineCount: number, totalCells: number
): boolean {
  const cells: number[] = Array.from({ length: totalCells }, (_, i) => i);
  let cursor = 0;
  const targetSet = new Set(targetPattern);

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];

    // Truncated search: if this mine position is a target tile, fail early
    if (targetSet.has(cells[i])) {
      return false;
    }
  }

  return true; // No target tiles are mines
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Set-based collision avoidance (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

function generateKenoNumbers(
  serverSeed: string, clientSeed: string, nonce: number,
  count: number, maxNum: number
): number[] {
  const drawn = new Set<number>();
  let cursor = 0;

  while (drawn.size < count) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;
    drawn.add(num);
  }

  return Array.from(drawn);
}

function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  const drawn = generateKenoNumbers(serverSeed, clientSeed, nonce, drawCount, maxNum);
  const drawnSet = new Set(drawn);
  const hits = selectedNumbers.filter((n) => drawnSet.has(n));
  return hits.length >= minHits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crash — industry standard (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

function validateCrashState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  const message = `${clientSeed}:${nonce}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);

  const h = parseInt(hash.slice(0, 13), 16);

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
