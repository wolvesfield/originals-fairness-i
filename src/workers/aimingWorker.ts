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

    // Pre-allocate buffers for performance (avoiding GC overhead in tight loop)
    const maxNum = gameType === 'KENO' ? (gameConfig.maxNum ?? 40) : (gameConfig.totalCells ?? 25);
    const targetFlags = new Uint8Array(maxNum + 1);
    for (const t of targetPattern) {
      targetFlags[t] = 1;
    }

    // Pre-allocate for MINES
    let cellsBuffer: Uint8Array | null = null;
    if (gameType === 'MINES') {
      cellsBuffer = new Uint8Array(gameConfig.totalCells ?? 25);
    }
    // Pre-allocate for KENO
    let drawnBuffer: Uint8Array | null = null;
    if (gameType === 'KENO') {
      drawnBuffer = new Uint8Array((gameConfig.maxNum ?? 40) + 1);
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
          isGold = validateMinesState(serverSeed, clientSeed, nonce, targetFlags, mineCount, totalCells, cellsBuffer!);
          break;
        }
        case 'KENO': {
          const drawCount = gameConfig.drawCount ?? 20;
          const max = gameConfig.maxNum ?? 40;
          const minHits = gameConfig.minKenoHits ?? Math.ceil(targetPattern.length * 0.5);
          isGold = validateKenoState(serverSeed, clientSeed, nonce, targetFlags, drawCount, max, minHits, drawnBuffer!);
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

/**
 * Generate Nth deterministic float for a given round.
 */
function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const hash = hmacSha256(serverSeed, clientSeed, nonce, cursor);
  return hashToFloat(hash);
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
 * ⚡ Bolt Optimization: Uses pre-allocated Uint8Arrays to eliminate GC overhead
 * previously caused by `Array.from()` and `new Set()` in tight loops.
 */
function validateMinesState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetFlags: Uint8Array, mineCount: number, totalCells: number, cellsBuffer: Uint8Array
): boolean {
  // Initialize pre-allocated cells buffer
  for (let i = 0; i < totalCells; i++) {
    cellsBuffer[i] = i;
  }
  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));

    const temp = cellsBuffer[i];
    cellsBuffer[i] = cellsBuffer[j];
    cellsBuffer[j] = temp;

    // Truncated search: if this mine position is a target tile, fail early
    if (targetFlags[cellsBuffer[i]] === 1) {
      return false;
    }
  }

  return true; // No target tiles are mines
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Set-based collision avoidance (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚡ Bolt Optimization: Uses pre-allocated Uint8Arrays to eliminate GC overhead
 * and inlines generation logic to avoid intermediate Set creation. Early exit
 * added when `minHits` is reached.
 */
function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetFlags: Uint8Array, drawCount: number, maxNum: number, minHits: number, drawnBuffer: Uint8Array
): boolean {
  // Clear pre-allocated drawn buffer
  drawnBuffer.fill(0);
  let drawnCount = 0;
  let cursor = 0;
  let hits = 0;

  while (drawnCount < drawCount) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;

    if (drawnBuffer[num] === 0) {
      drawnBuffer[num] = 1;
      drawnCount++;

      if (targetFlags[num] === 1) {
        hits++;
        if (hits >= minHits) {
          return true; // Early exit: we have enough hits
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
  const message = `${clientSeed}:${nonce}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);

  const h = parseInt(hash.slice(0, 13), 16);

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
