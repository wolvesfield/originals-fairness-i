import CryptoJS from 'crypto-js';

let lastSeed = '';
let lastHmac: any = null;

export function calculateCrashPointOld(serverSeed: string, clientSeed: string, nonce: number): number {
  const message = `${clientSeed}:${nonce}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);

  const h = parseInt(hash.slice(0, 13), 16);

  if (h % 33 === 0) {
    return 1;
  }

  const TWO_52 = Math.pow(2, 52);
  const result = Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100;

  return Math.max(1, result);
}

export function calculateCrashPointNew(serverSeed: string, clientSeed: string, nonce: number): number {
  if (serverSeed !== lastSeed || !lastHmac) {
    lastSeed = serverSeed;
    lastHmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
  } else {
    lastHmac.reset();
  }

  const message = `${clientSeed}:${nonce}`;
  lastHmac.update(message);
  const hash = lastHmac.finalize();

  // To get the first 13 hex characters from the 32-bit words...
  // 13 hex chars = 52 bits.
  // words[0] has 32 bits (8 hex chars)
  // words[1] has 32 bits (8 hex chars). We need the top 20 bits of words[1] (5 hex chars).

  // words[0] >>> 0 is the top 32 bits
  const w0 = hash.words[0] >>> 0;
  // words[1] >>> 12 gives the top 20 bits
  const w1 = hash.words[1] >>> 12;

  // Combine: w0 * 2^20 + w1
  const h = w0 * 1048576 + w1;

  if (h % 33 === 0) {
    return 1;
  }

  const TWO_52 = Math.pow(2, 52); // 4503599627370496
  const result = Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100;

  return Math.max(1, result);
}

for (let i = 0; i < 1000; i++) {
  const oldC = calculateCrashPointOld('seed1', 'client', i);
  const newC = calculateCrashPointNew('seed1', 'client', i);
  if (oldC !== newC) {
    console.error(`Mismatch at ${i}: old=${oldC}, new=${newC}`);
  }
}

const startOld = Date.now();
for (let i = 0; i < 100000; i++) {
  calculateCrashPointOld('seed1', 'client', i);
}
console.log('Old:', Date.now() - startOld);

const startNew = Date.now();
for (let i = 0; i < 100000; i++) {
  calculateCrashPointNew('seed1', 'client', i);
}
console.log('New:', Date.now() - startNew);
