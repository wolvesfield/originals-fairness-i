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

// [Optimization] Cache HMAC instance to avoid repeated CryptoJS.algo.HMAC.create
let cachedHmacServerSeed: string | null = null;
let cachedHmacInstance: any = null;

function getHmacInstance(serverSeed: string) {
  if (cachedHmacServerSeed !== serverSeed) {
    cachedHmacInstance = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    cachedHmacServerSeed = serverSeed;
  }
  return cachedHmacInstance;
}

/**
 * HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:cursor)
 */

/**
 * Convert first 4 bytes (8 hex chars) to float in [0, 1).
 * int(first_8_hex) / 2^32
 */

/**
 * Generate Nth deterministic float for a given round.
 */
function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const hmac = getHmacInstance(serverSeed);
  hmac.reset();
  hmac.update(`${clientSeed}:${nonce}:${cursor}`);
  const hash = hmac.finalize();
  // [Optimization] Extract 32-bit float without string conversion
  return (hash.words[0] >>> 0) / 4294967296;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mines — Fisher-Yates shuffle (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns mineCount unique cell indices using Fisher-Yates shuffle.
 * Consumes one float per swap via incrementing cursor.
 */

/**
 * Truncated search: early-exit if any target tile is already in a mine swap
 * position BEFORE finishing all mineCount iterations. This avoids computing
 * all mine positions when we can already tell a target tile is mined.
 */
// [Optimization] Pre-allocate structures to avoid GC pressure
const PREALLOC_CELLS = new Uint8Array(200); // Max cells usually 25, cap at 200 to be safe
const PREALLOC_TARGET_MAP = new Uint8Array(200);
let cachedTargetHash = "";

function validateMinesState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetPattern: number[], mineCount: number, totalCells: number
): boolean {
  // Setup cell array
  for (let i = 0; i < totalCells; i++) PREALLOC_CELLS[i] = i;
  let cursor = 0;

  // Setup target map
  const targetHash = targetPattern.join(',');
  if (cachedTargetHash !== targetHash) {
    for (let i = 0; i < totalCells; i++) PREALLOC_TARGET_MAP[i] = 0;
    for (let i = 0; i < targetPattern.length; i++) PREALLOC_TARGET_MAP[targetPattern[i]] = 1;
    cachedTargetHash = targetHash;
  }

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));

    // Swap
    const temp = PREALLOC_CELLS[i];
    PREALLOC_CELLS[i] = PREALLOC_CELLS[j];
    PREALLOC_CELLS[j] = temp;

    // Truncated search: if this mine position is a target tile, fail early
    if (PREALLOC_TARGET_MAP[PREALLOC_CELLS[i]] === 1) {
      return false;
    }
  }

  return true; // No target tiles are mines
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Set-based collision avoidance (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────


// [Optimization] Pre-allocate structure
const PREALLOC_KENO_DRAWN = new Uint8Array(100);

function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  for (let i = 0; i <= maxNum; i++) PREALLOC_KENO_DRAWN[i] = 0;

  let cursor = 0;
  let drawnSize = 0;

  while (drawnSize < drawCount) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;

    if (PREALLOC_KENO_DRAWN[num] === 0) {
      PREALLOC_KENO_DRAWN[num] = 1;
      drawnSize++;
    }
  }

  let hitCount = 0;
  for (let i = 0; i < selectedNumbers.length; i++) {
    if (PREALLOC_KENO_DRAWN[selectedNumbers[i]] === 1) {
      hitCount++;
    }
  }

  return hitCount >= minHits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crash — industry standard (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

function validateCrashState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  const message = `${clientSeed}:${nonce}`;
  const hmac = getHmacInstance(serverSeed);
  hmac.reset();
  hmac.update(message);
  const hash = hmac.finalize();

  // [Optimization] Compute directly from words without hex string conversion
  // Extract 52-bit integer: first 32-bit element + 20 bits from second element
  const h = (hash.words[0] >>> 0) * 1048576 + (hash.words[1] >>> 12);

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
