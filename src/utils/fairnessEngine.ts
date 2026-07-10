import CryptoJS from 'crypto-js'

// ---------------------------------------------------------------------------
// Core: Deterministic float from HMAC-SHA256
// Produces a value in [0, 1) – never uses Math.random().
// ---------------------------------------------------------------------------

/**
 * HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:cursor)
 * Returns the full hex digest (64 hex chars / 256 bits).
 */
export function hmacSha256(serverSeed: string, clientSeed: string, nonce: number, cursor: number, platform: 'stake' | 'roobet' = 'stake'): string {
  const message = platform === 'roobet'
    ? `${clientSeed}-${nonce}-${cursor}`
    : `${clientSeed}:${nonce}:${cursor}`
  return CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex)
}

/**
 * Convert the first 4 bytes (8 hex chars) of a hex hash to a float in [0, 1).
 * int(first_8_hex) / 2^32
 */
export function hashToFloat(hash: string): number {
  const slice = hash.slice(0, 8)
  const int = parseInt(slice, 16)          // 0 .. 0xFFFFFFFF
  return int / 4294967296                   // 0 .. < 1
}

/**
 * Convenience: generate the Nth deterministic float for a given round.
 */
export function generateFloat(serverSeed: string, clientSeed: string, nonce: number, cursor: number, platform: 'stake' | 'roobet' = 'stake'): number {
  const hash = hmacSha256(serverSeed, clientSeed, nonce, cursor, platform)
  return hashToFloat(hash)
}

// ---------------------------------------------------------------------------
// Crash – provably fair multiplier
// ---------------------------------------------------------------------------

/**
 * Crash multiplier derived from HMAC-SHA256.
 *
 * Algorithm (industry standard):
 *   1. hash = HMAC_SHA256(serverSeed, clientSeed)
 *      – We include nonce in clientSeed component as `clientSeed:nonce`.
 *   2. h = first 13 hex characters of hash, parsed as integer.
 *   3. if h % 33 === 0 → result = 1  (the "instant crash" / house edge).
 *   4. Otherwise:  result = floor( (100 * 2^52 - h) / (2^52 - h) ) / 100
 *   5. Return max(1, result) to guarantee minimum 1.00x.
 */
export function calculateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  const message = `${clientSeed}:${nonce}`
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex)

  // First 13 hex chars → integer (fits within JS safe integer range: 16^13 ≈ 4.5e15 < 2^53)
  const h = parseInt(hash.slice(0, 13), 16)

  // House edge: ~3 % of rounds instant-crash at 1.00x
  if (h % 33 === 0) {
    return 1
  }

  const TWO_52 = Math.pow(2, 52)
  const result = Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100

  return Math.max(1, result)
}

// ---------------------------------------------------------------------------
// Mines – Fisher-Yates shuffle
// ---------------------------------------------------------------------------

/**
 * Returns an array of `mineCount` unique cell indices in [0, totalCells).
 *
 * Uses a Fisher-Yates (Knuth) shuffle on the full cell array, consuming one
 * deterministic float per swap (incrementing cursor each time), then takes
 * the first `mineCount` elements.
 */

// Pre-allocated array for Mines Fisher-Yates shuffle
let minesCellsArray = new Int32Array(100);

/**
 * Returns an array of `mineCount` unique cell indices in [0, totalCells).
 *
 * Uses a Fisher-Yates (Knuth) shuffle on the full cell array, consuming one
 * deterministic float per swap (incrementing cursor each time), then takes
 * the first `mineCount` elements.
 */
export function generateMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number,
  totalCells: number,
  platform?: 'stake' | 'roobet'
): number[] {
  // Stake exclusively supports 5x5 (25 cells). Roobet dictates 36, 49, 64.
  // If the explicit platform is omitted, infer based on geographic limits.
  const activePlatform = platform || (totalCells !== 25 ? 'roobet' : 'stake')

  if (activePlatform === 'roobet') {
    // Roobet uses simple picking with re-rolls
    const mines: number[] = []
    let cursor = 0
    while (mines.length < mineCount) {
      const float = generateFloat(serverSeed, clientSeed, nonce, cursor, activePlatform)
      const mine = Math.floor(float * totalCells)
      if (!mines.includes(mine)) {
        mines.push(mine)
      }
      cursor++
    }
    return mines.sort((a, b) => a - b)
  } else {
    // Stake uses Fisher-Yates
    if (totalCells > minesCellsArray.length) {
      minesCellsArray = new Int32Array(totalCells);
    }

    for (let i = 0; i < totalCells; i++) {
      minesCellsArray[i] = i;
    }

    let cursor = 0

    // Fisher-Yates shuffle (we only need `mineCount` iterations)
    for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
      const float = generateFloat(serverSeed, clientSeed, nonce, cursor, activePlatform)
      cursor++

      const j = Math.floor(float * (i + 1))   // random index in [0, i]
      // Swap
      const temp = minesCellsArray[i];
      minesCellsArray[i] = minesCellsArray[j];
      minesCellsArray[j] = temp;
    }

    // The last `mineCount` positions in the array are the mines
    const mines = new Array(mineCount);
    for (let i = 0; i < mineCount; i++) {
        mines[i] = minesCellsArray[totalCells - mineCount + i];
    }
    return mines.sort((a, b) => a - b)
  }
}

// ---------------------------------------------------------------------------
// Keno – unique number selection
// ---------------------------------------------------------------------------

// Pre-allocated array for Keno collision tracking
let kenoCollisionArray = new Uint8Array(101);

/**
 * Draws exactly `count` unique numbers from [1, maxNum].
 *
 * Uses the float generator; on collision the cursor increments and we redraw
 * until we have the required count.  Default: 10 draws from 1-40.
 */
export function generateKenoNumbers(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  count: number = 10,
  maxNum: number = 40
): number[] {
  if (maxNum + 1 > kenoCollisionArray.length) {
    kenoCollisionArray = new Uint8Array(maxNum + 1);
  }

  kenoCollisionArray.fill(0);
  let cursor = 0;
  let hits = 0;
  const result = new Array(count);

  while (hits < count) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor)
    cursor++

    const num = Math.floor(float * maxNum) + 1   // 1 .. maxNum
    if (kenoCollisionArray[num] === 0) {
      kenoCollisionArray[num] = 1;
      result[hits] = num;
      hits++;
    }
  }

  return result.sort((a, b) => a - b)
}
