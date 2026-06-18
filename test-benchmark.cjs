const CryptoJS = require("crypto-js");

function generateFloatOld(serverSeed, clientSeed, nonce, cursor) {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);
  const slice = hash.slice(0, 8);
  const int = parseInt(slice, 16);
  return int / 4294967296;
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

function generateFloatNew(serverSeed, clientSeed, nonce, cursor) {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  const hmac = getHmac(serverSeed);
  hmac.reset();
  hmac.update(message);
  const hash = hmac.finalize();
  return (hash.words[0] >>> 0) / 4294967296;
}

const N = 100000;
const serverSeed = "someServerSeed1234567890";
const clientSeed = "clientSeed9876543210";

console.time("Old");
let sum1 = 0;
for (let i = 0; i < N; i++) {
  sum1 += generateFloatOld(serverSeed, clientSeed, i, 0);
}
console.timeEnd("Old");

console.time("New");
let sum2 = 0;
for (let i = 0; i < N; i++) {
  sum2 += generateFloatNew(serverSeed, clientSeed, i, 0);
}
console.timeEnd("New");

console.log(sum1, sum2);
