import CryptoJS from 'crypto-js';

function generateFloatOld(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);
  const slice = hash.slice(0, 8);
  const int = parseInt(slice, 16);
  return int / 4294967296;
}

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

  // Direct bitwise float extraction from words array
  // hash.words[0] is a 32-bit signed integer. Convert to unsigned with >>> 0.
  const int = hash.words[0] >>> 0;
  return int / 4294967296;
}

const startOld = Date.now();
for(let i=0; i<100000; i++) {
  generateFloatOld('serverSeed123', 'clientSeed456', 1, i);
}
console.log('Old:', Date.now() - startOld);

const startNew = Date.now();
for(let i=0; i<100000; i++) {
  generateFloatNew('serverSeed123', 'clientSeed456', 1, i);
}
console.log('New:', Date.now() - startNew);
