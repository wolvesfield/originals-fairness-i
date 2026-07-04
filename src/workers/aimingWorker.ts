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

let cachedHmac: any = null;
let cachedKey = '';

/**
 * Generate Nth deterministic float for a given round using a cached HMAC instance.
 */
function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  if (serverSeed !== cachedKey || !cachedHmac) {
    cachedHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    cachedKey = serverSeed;
  } else {
    cachedHmac.reset();
  }
  const message = `${clientSeed}:${nonce}:${cursor}`;
  cachedHmac.update(message);
  const hash = cachedHmac.finalize();
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// Global buffers for Mines early-exit validation
const maxCellsBuffer = new Int32Array(100);
const validateMinesBuffer = new Uint8Array(100);

/**
 * Truncated search: early-exit if any target tile is already in a mine swap
 * position BEFORE finishing all mineCount iterations. This avoids computing
 * all mine positions when we can already tell a target tile is mined.
 * Uses global buffers to prevent GC pressure.
 */
function validateMinesState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetPattern: number[], mineCount: number, totalCells: number
): boolean {
  for (let i = 0; i < totalCells; i++) maxCellsBuffer[i] = i;
  let cursor = 0;

  validateMinesBuffer.fill(0);
  for (let i = 0; i < targetPattern.length; i++) {
    validateMinesBuffer[targetPattern[i]] = 1;
  }

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));

    const temp = maxCellsBuffer[i];
    maxCellsBuffer[i] = maxCellsBuffer[j];
    maxCellsBuffer[j] = temp;

    if (validateMinesBuffer[maxCellsBuffer[i]] === 1) {
      return false;
    }
  }

  return true; // No target tiles are mines
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Set-based collision avoidance (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

// Global buffer for fast Keno validation without allocating Sets
const validateKenoBuffer = new Uint8Array(81); // Supports up to 80 maxNum

function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  validateKenoBuffer.fill(0);

  for (let i = 0; i < selectedNumbers.length; i++) {
    validateKenoBuffer[selectedNumbers[i]] = 2; // 2 means target tile
  }

  let cursor = 0;
  let drawnCount = 0;
  let hits = 0;

  while (drawnCount < drawCount) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;

    const state = validateKenoBuffer[num];
    if (state === 0) {
      validateKenoBuffer[num] = 1;
      drawnCount++;
    } else if (state === 2) {
      validateKenoBuffer[num] = 3;
      drawnCount++;
      hits++;
      if (hits >= minHits) {
        return true;
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
