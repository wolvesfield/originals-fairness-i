/**
 * OpSec Traffic Mimicry — Anti-Detection Utilities
 *
 * Provides human-like request timing (Poisson distribution), dictionary client seed
 * generation, and browser fingerprint rotation for Stake.com API interactions.
 */

// ---------------------------------------------------------------------------
// Poisson-distributed delay — mimics human click intervals
// Mean ~2.5s with natural variance
// ---------------------------------------------------------------------------

/**
 * Generate a Poisson-distributed delay in milliseconds.
 * Uses the inverse transform method.
 *
 * @param meanMs  Average delay in milliseconds (default 2500)
 * @param minMs   Floor to prevent 0ms delays (default 500)
 * @param maxMs   Cap to prevent excessively long waits (default 12000)
 */
export function poissonDelay(meanMs: number = 2500, minMs: number = 500, maxMs: number = 12000): number {
  // Inverse transform: -ln(U) * mean
  const u = Math.random()
  const raw = -Math.log(1 - u) * meanMs
  return Math.max(minMs, Math.min(maxMs, Math.round(raw)))
}

/**
 * Await a Poisson-distributed delay. Use between API calls.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function humanDelay(meanMs?: number): Promise<void> {
  const delay = poissonDelay(meanMs)
  return sleep(delay)
}

// ---------------------------------------------------------------------------
// Dictionary client seeds — realistic-looking seeds
// ---------------------------------------------------------------------------

const CLIENT_SEED_WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
  'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
  'xray', 'yankee', 'zulu', 'crypto', 'lucky', 'diamond', 'moon', 'star',
  'rocket', 'nova', 'orbit', 'pulse', 'quantum', 'vortex', 'zenith', 'apex',
  'blaze', 'cipher', 'drift', 'ember', 'flux', 'glyph', 'helix', 'ionic',
]

const CLIENT_SEED_SUFFIXES = [
  '', '42', '777', '99', '2024', '2025', 'x', 'pro', '_go', '!', '#1',
]

/**
 * Generate a plausible client seed string.
 * Returns something like "alpha42", "quantumx", "cipher777"
 */
export function randomClientSeed(): string {
  const word = CLIENT_SEED_WORDS[Math.floor(Math.random() * CLIENT_SEED_WORDS.length)]
  const suffix = CLIENT_SEED_SUFFIXES[Math.floor(Math.random() * CLIENT_SEED_SUFFIXES.length)]
  return `${word}${suffix}`
}

// ---------------------------------------------------------------------------
// Browser fingerprint rotation
// ---------------------------------------------------------------------------

interface BrowserFingerprint {
  'User-Agent': string
  'sec-ch-ua': string
  'sec-ch-ua-platform': string
  'sec-ch-ua-mobile': string
}

const FINGERPRINTS: BrowserFingerprint[] = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-mobile': '?0',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    'sec-ch-ua-platform': '"macOS"',
    'sec-ch-ua-mobile': '?0',
  },
  {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="143", "Not(A:Brand";v="24", "Google Chrome";v="143"',
    'sec-ch-ua-platform': '"Linux"',
    'sec-ch-ua-mobile': '?0',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'sec-ch-ua': '',
    'sec-ch-ua-platform': '',
    'sec-ch-ua-mobile': '',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'sec-ch-ua': '',
    'sec-ch-ua-platform': '',
    'sec-ch-ua-mobile': '',
  },
]

let lastFingerprint = -1

/**
 * Select a random browser fingerprint, avoiding immediate repeats.
 */
export function rotateFingerprint(): BrowserFingerprint {
  let idx: number
  do {
    idx = Math.floor(Math.random() * FINGERPRINTS.length)
  } while (idx === lastFingerprint && FINGERPRINTS.length > 1)
  lastFingerprint = idx
  return FINGERPRINTS[idx]
}

/**
 * Build full Stake.com headers with a rotated fingerprint.
 */
export function stakeHeadersWithRotation(token: string, operationName?: string): Record<string, string> {
  const fp = rotateFingerprint()
  const headers: Record<string, string> = {
    'Accept': 'application/graphql+json, application/json',
    'Content-Type': 'application/json',
    'Origin': 'https://stake.com',
    'Referer': 'https://stake.com/',
    'User-Agent': fp['User-Agent'],
    'x-access-token': token,
    'x-language': 'en',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  }

  // Only add sec-ch-ua headers for Chrome fingerprints
  if (fp['sec-ch-ua']) {
    headers['sec-ch-ua'] = fp['sec-ch-ua']
    headers['sec-ch-ua-platform'] = fp['sec-ch-ua-platform']
    headers['sec-ch-ua-mobile'] = fp['sec-ch-ua-mobile']
  }

  if (operationName) {
    headers['x-operation-name'] = operationName
  }

  return headers
}
