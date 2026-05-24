// Provably-fair verification engine.
//
// This module RECOMPUTES the outcome of an already-settled round from a
// REVEALED server seed. It is a verifier, not a predictor: every output here
// is fully determined by (serverSeed, clientSeed, nonce). Without the revealed
// server seed there is nothing to compute, because the outcome is the output of
// HMAC-SHA256, which is indistinguishable from random.
//
// Works in a Chrome extension popup and in Node 20+ (both expose Web Crypto).

const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
if (!subtle) {
  throw new Error('Web Crypto (crypto.subtle) is required.');
}

const encoder = new TextEncoder();

async function hmacSha256Bytes(key, message) {
  const cryptoKey = await subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return new Uint8Array(signature); // 32 bytes
}

export async function sha256Hex(message) {
  const digest = await subtle.digest('SHA-256', encoder.encode(message));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Confirms the casino's pre-committed hash matches the seed it later revealed.
export async function verifyCommitment(serverSeed, expectedHash) {
  if (!expectedHash) return null;
  const actual = await sha256Hex(serverSeed);
  return actual.toLowerCase() === expectedHash.trim().toLowerCase();
}

// Canonical Stake-style byte stream: HMAC-SHA256(serverSeed, clientSeed:nonce:round),
// consumed 4 bytes at a time, each group mapped to a float in [0, 1).
function createFloatStream(serverSeed, clientSeed, nonce) {
  let round = 0;
  let buffer = [];

  async function refill() {
    const bytes = await hmacSha256Bytes(serverSeed, `${clientSeed}:${nonce}:${round}`);
    buffer.push(...bytes);
    round += 1;
  }

  return async function nextFloat() {
    while (buffer.length < 4) {
      // eslint-disable-next-line no-await-in-loop
      await refill();
    }
    const [a, b, c, d] = buffer.splice(0, 4);
    return a / 256 + b / 256 ** 2 + c / 256 ** 3 + d / 256 ** 4;
  };
}

// Generic "pick N unique cells from a pool" used by grid games.
async function pickUnique(nextFloat, poolSize, count) {
  const pool = Array.from({ length: poolSize }, (_, i) => i);
  const picked = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const f = await nextFloat();
    const index = Math.floor(f * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

// --- Games -----------------------------------------------------------------
// Mines and Dice follow Stake's published algorithm.
// Moles and Drill are modeled as configurable grid/row games — confirm the
// parameters (grid size, traps per row) against your platform's own fairness
// documentation before trusting the recomputed layout.

export async function verifyMines(serverSeed, clientSeed, nonce, opts = {}) {
  const { minesCount = 3, totalCells = 25 } = opts;
  const nextFloat = createFloatStream(serverSeed, clientSeed, nonce);
  const mines = await pickUnique(nextFloat, totalCells, minesCount);
  return { minePositions: mines.sort((x, y) => x - y), totalCells, minesCount };
}

export async function verifyDice(serverSeed, clientSeed, nonce) {
  const nextFloat = createFloatStream(serverSeed, clientSeed, nonce);
  const f = await nextFloat();
  const roll = Math.floor(f * 10001) / 100; // 0.00 .. 100.00
  return { roll };
}

export async function verifyMoles(serverSeed, clientSeed, nonce, opts = {}) {
  const { moleCount = 5, totalCells = 25 } = opts;
  const nextFloat = createFloatStream(serverSeed, clientSeed, nonce);
  const moles = await pickUnique(nextFloat, totalCells, moleCount);
  return { molePositions: moles.sort((x, y) => x - y), totalCells, moleCount };
}

export async function verifyDrill(serverSeed, clientSeed, nonce, opts = {}) {
  const { rows = 9, tilesPerRow = 3, trapsPerRow = 1 } = opts;
  const nextFloat = createFloatStream(serverSeed, clientSeed, nonce);
  const layout = [];
  for (let r = 0; r < rows; r += 1) {
    // eslint-disable-next-line no-await-in-loop
    const traps = await pickUnique(nextFloat, tilesPerRow, trapsPerRow);
    layout.push(traps.sort((x, y) => x - y));
  }
  return { rows, tilesPerRow, trapsPerRow, trapsByRow: layout };
}

export const GAMES = {
  mines: verifyMines,
  dice: verifyDice,
  moles: verifyMoles,
  drill: verifyDrill,
};

export async function verifyRound(game, serverSeed, clientSeed, nonce, opts) {
  const fn = GAMES[game];
  if (!fn) throw new Error(`Unknown game: ${game}`);
  return fn(serverSeed, clientSeed, nonce, opts);
}
