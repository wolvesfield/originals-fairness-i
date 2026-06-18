const CryptoJS = require("crypto-js");

function validateCrashOld(serverSeed, clientSeed, nonce, targetMultiplier) {
  const message = `${clientSeed}:${nonce}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);

  const h = parseInt(hash.slice(0, 13), 16);
  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52);
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}

const hmacCache = new Map();
function getHmac(serverSeed) {
  let hmac = hmacCache.get(serverSeed);
  if (!hmac) {
    hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    hmacCache.set(serverSeed, hmac);
  }
  return hmac;
}

function validateCrashNew(serverSeed, clientSeed, nonce, targetMultiplier) {
  const message = `${clientSeed}:${nonce}`;
  const hmac = getHmac(serverSeed);
  hmac.reset();
  hmac.update(message);
  const hash = hmac.finalize();

  const h = (hash.words[0] >>> 0) * 1048576 + (hash.words[1] >>> 12);

  if (h % 33 === 0) return 1.0 >= targetMultiplier;

  const TWO_52 = Math.pow(2, 52); // 4503599627370496
  const multiplier = Math.max(1, Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100);
  return multiplier >= targetMultiplier;
}

const N = 100000;
const serverSeed = "someServerSeed1234567890";
const clientSeed = "clientSeed9876543210";

console.time("Old");
let c1 = 0;
for (let i = 0; i < N; i++) {
  if (validateCrashOld(serverSeed, clientSeed, i, 2.0)) c1++;
}
console.timeEnd("Old");

console.time("New");
let c2 = 0;
for (let i = 0; i < N; i++) {
  if (validateCrashNew(serverSeed, clientSeed, i, 2.0)) c2++;
}
console.timeEnd("New");

console.log(c1, c2);
