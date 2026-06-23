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

/**
 * HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:cursor)
 */
function hmacSha256(serverSeed: string, clientSeed: string, nonce: number, cursor: number): string {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  return CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);
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

// Cache HMAC instance for performance in hot paths
let cachedHmac: any = null;
let lastSeed: string | null = null;

/**
 * Generate Nth deterministic float for a given round.
 * Optimized with cached HMAC and direct bitwise extraction to prevent
 * string allocation bottlenecks.
 */
function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  if (serverSeed !== lastSeed || !cachedHmac) {
    cachedHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    lastSeed = serverSeed;
  }

  const message = `${clientSeed}:${nonce}:${cursor}`;

  cachedHmac.reset();
  cachedHmac.update(message);
  const hash = cachedHmac.finalize();

  // Extract first 4 bytes as an unsigned 32-bit integer directly from the words array
  const w0 = hash.words[0] >>> 0;
  return w0 / 4294967296;
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
  // Use Uint8Array instead of Array.from to prevent GC overhead in hot loops
  const cells = new Uint8Array(totalCells);
  for (let i = 0; i < totalCells; i++) cells[i] = i;

  const targetSet = new Uint8Array(totalCells);
  for (let i = 0; i < targetPattern.length; i++) targetSet[targetPattern[i]] = 1;

  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));

    // Swap
    const temp = cells[i];
    cells[i] = cells[j];
    cells[j] = temp;

    // Truncated search: if this mine position is a target tile, fail early
    if (targetSet[cells[i]] === 1) {
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
  // Use a pre-allocated typed array for collision detection mapping instead of a Set
  const drawn = new Uint8Array(maxNum + 1);
  const result: number[] = new Array(count);
  let hits = 0;
  let cursor = 0;

  while (hits < count) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;
    if (drawn[num] === 0) {
      drawn[num] = 1;
      result[hits++] = num;
    }
  }

  return result.sort((a, b) => a - b);
}

function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  // Fast path for brute-forcing Keno hits using direct typed array lookups
  // Avoids allocating the full result array and Set mapping in hot paths
  const drawn = new Uint8Array(maxNum + 1);
  const selectedSet = new Uint8Array(maxNum + 1);
  for (let i = 0; i < selectedNumbers.length; i++) {
    selectedSet[selectedNumbers[i]] = 1;
  }

  let hits = 0;
  let matches = 0;
  let cursor = 0;

  while (hits < drawCount) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;

    const num = Math.floor(float * maxNum) + 1;
    if (drawn[num] === 0) {
      drawn[num] = 1;
      hits++;

      if (selectedSet[num] === 1) {
        matches++;
        if (matches >= minHits) {
          return true; // Early exit on reaching required hits
        }
      }
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crash — industry standard (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

function validateCrashState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  if (serverSeed !== lastSeed || !cachedHmac) {
    cachedHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    lastSeed = serverSeed;
  }

  const message = `${clientSeed}:${nonce}`;

  cachedHmac.reset();
  cachedHmac.update(message);
  const hash = cachedHmac.finalize();

  // First 13 hex chars = 52 bits. Extract this directly from the 32-bit words.
  const w0 = hash.words[0] >>> 0;
  const w1 = hash.words[1] >>> 0;
  const h = w0 * 1048576 + (w1 >>> 12); // 1048576 = 2^20

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
