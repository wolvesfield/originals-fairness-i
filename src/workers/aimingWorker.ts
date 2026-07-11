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
let lastSeedForFloat = '';
let hmacCacheForFloat: any = null;


function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  if (serverSeed !== lastSeedForFloat || !hmacCacheForFloat) {
    hmacCacheForFloat = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    lastSeedForFloat = serverSeed;
  }
  hmacCacheForFloat.reset();
  hmacCacheForFloat.update(`${clientSeed}:${nonce}:${cursor}`);
  const hash = hmacCacheForFloat.finalize();
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
const cellsArray = new Int32Array(256); // Safe size up to 256 cells

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateMinePositions(
  serverSeed: string, clientSeed: string, nonce: number,
  mineCount: number, totalCells: number
): number[] {
  for (let i = 0; i < totalCells; i++) {
    cellsArray[i] = i;
  }
  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));
    const temp = cellsArray[i];
    cellsArray[i] = cellsArray[j];
    cellsArray[j] = temp;
  }

  const mines = new Array(mineCount);
  for(let i=0; i<mineCount; i++) {
    mines[i] = cellsArray[totalCells - mineCount + i];
  }
  return mines;
}

const targetArray = new Uint8Array(256);
function validateMinesState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetPattern: number[], mineCount: number, totalCells: number
): boolean {
  for (let i = 0; i < totalCells; i++) {
    cellsArray[i] = i;
  }
  targetArray.fill(0);
  for (let i = 0; i < targetPattern.length; i++) {
      targetArray[targetPattern[i]] = 1;
  }

  let cursor = 0;

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));

    const temp = cellsArray[i];
    cellsArray[i] = cellsArray[j];
    cellsArray[j] = temp;

    if (targetArray[cellsArray[i]] === 1) {
      return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keno — Set-based collision avoidance (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

const kenoDrawnArray = new Uint8Array(256);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateKenoNumbers(
  serverSeed: string, clientSeed: string, nonce: number,
  count: number, maxNum: number
): number[] {
  kenoDrawnArray.fill(0, 0, maxNum + 2);
  const result = new Array(count);
  let resultIdx = 0;
  let cursor = 0;

  while (resultIdx < count) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;
    if (kenoDrawnArray[num] === 0) {
      kenoDrawnArray[num] = 1;
      result[resultIdx++] = num;
    }
  }

  return result;
}

function validateKenoState(
  serverSeed: string, clientSeed: string, nonce: number,
  selectedNumbers: number[], drawCount: number, maxNum: number, minHits: number
): boolean {
  kenoDrawnArray.fill(0, 0, maxNum + 2);
  let hits = 0;
  let uniqueDrawn = 0;
  let cursor = 0;

  while (uniqueDrawn < drawCount) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const num = Math.floor(float * maxNum) + 1;

    if (kenoDrawnArray[num] === 0) {
        kenoDrawnArray[num] = 1;
        uniqueDrawn++;

        for(let i=0; i<selectedNumbers.length; i++) {
            if (selectedNumbers[i] === num) {
                hits++;
                if (hits >= minHits) {
                    return true;
                }
                break;
            }
        }
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crash — industry standard (identical to fairnessEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

let lastSeedForCrash = '';
let hmacCacheForCrash: any = null;

function validateCrashState(
  serverSeed: string, clientSeed: string, nonce: number,
  targetMultiplier: number
): boolean {
  if (serverSeed !== lastSeedForCrash || !hmacCacheForCrash) {
    hmacCacheForCrash = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    lastSeedForCrash = serverSeed;
  }

  hmacCacheForCrash.reset();
  hmacCacheForCrash.update(`${clientSeed}:${nonce}`);
  const hash = hmacCacheForCrash.finalize();

  const w0 = hash.words[0] >>> 0;
  const w1 = hash.words[1] >>> 0;
  const h = (w0 * 1048576) + (w1 >>> 12);

  // House edge: ~3% instant crash
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}
