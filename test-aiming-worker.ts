import CryptoJS from 'crypto-js';

let lastSeed = '';
let lastHmac: any = null;

function generateFloatNew(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  if (serverSeed !== lastSeed || !lastHmac) {
    lastSeed = serverSeed;
    lastHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
  } else {
    lastHmac.reset();
  }

  const message = `${clientSeed}:${nonce}:${cursor}`;
  lastHmac.update(message);
  const hash = lastHmac.finalize();

  const int = hash.words[0] >>> 0;
  return int / 4294967296;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core crypto — matches fairnessEngine.ts exactly
// ─────────────────────────────────────────────────────────────────────────────

function hmacSha256(serverSeed: string, clientSeed: string, nonce: number, cursor: number): string {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  return CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);
}

function hashToFloat(hash: string): number {
  const slice = hash.slice(0, 8);
  const int = parseInt(slice, 16);
  return int / 4294967296;
}

function generateFloatOld(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const hash = hmacSha256(serverSeed, clientSeed, nonce, cursor);
  return hashToFloat(hash);
}

function testEquality() {
  let success = true;
  for (let i = 0; i < 1000; i++) {
    const oldFloat = generateFloatOld('serverSeed123', 'clientSeed456', 1, i);
    const newFloat = generateFloatNew('serverSeed123', 'clientSeed456', 1, i);

    if (oldFloat !== newFloat) {
      console.error(`Mismatch at cursor ${i}: old=${oldFloat}, new=${newFloat}`);
      success = false;
      break;
    }
  }

  if (success) {
    console.log("All floats match!");
  }
}

testEquality();
