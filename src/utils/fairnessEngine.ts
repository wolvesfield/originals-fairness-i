import CryptoJS from 'crypto-js'

// ---------------------------------------------------------------------------
// Core: Deterministic float from HMAC-SHA256
// Produces a value in [0, 1) – never uses Math.random().
// ---------------------------------------------------------------------------

let cachedHmac: any = null;
let cachedServerSeed: string | null = null;

function getHmac(serverSeed: string) {
  if (serverSeed !== cachedServerSeed) {
    cachedHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    cachedServerSeed = serverSeed;
  }
  cachedHmac.reset();
  return cachedHmac;
}

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
  const message = platform === 'roobet'
    ? `${clientSeed}-${nonce}-${cursor}`
    : `${clientSeed}:${nonce}:${cursor}`

  const hmac = getHmac(serverSeed);
  hmac.update(message);
  const hash = hmac.finalize();
  return (hash.words[0] >>> 0) / 4294967296;
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
  const hmac = getHmac(serverSeed);
  hmac.update(message);
  const hash = hmac.finalize();

  const h = (hash.words[0] >>> 0) * 1048576 + (hash.words[1] >>> 12);

  // House edge: ~3 % of rounds instant-crash at 1.00x
  if (h % 33 === 0) {
    return 1
  }

  const TWO_52 = 4503599627370496; // Math.pow(2, 52)
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
    const cells: number[] = Array.from({ length: totalCells }, (_, i) => i)
    let cursor = 0

    // Fisher-Yates shuffle (we only need `mineCount` iterations)
    for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
      const float = generateFloat(serverSeed, clientSeed, nonce, cursor, activePlatform)
      cursor++

      const j = Math.floor(float * (i + 1))   // random index in [0, i]
        // Swap
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
    }

    // The last `mineCount` positions in the array are the mines
    const mines = cells.slice(totalCells - mineCount)
    return mines.sort((a, b) => a - b)
  }
}

// ---------------------------------------------------------------------------
// Keno – unique number selection
// ---------------------------------------------------------------------------

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
  const drawn = new Set<number>()
  let cursor = 0

  while (drawn.size < count) {
    const float = generateFloat(serverSeed, clientSeed, nonce, cursor)
    cursor++

    const num = Math.floor(float * maxNum) + 1   // 1 .. maxNum
    drawn.add(num)                                // Set ignores duplicates
  }

  return Array.from(drawn).sort((a, b) => a - b)
}
