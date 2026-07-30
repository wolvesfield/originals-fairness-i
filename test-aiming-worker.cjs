const CryptoJS = require('crypto-js');

let hmacCache = null;
let lastServerSeed = "";

function getHmac(serverSeed) {
  if (!hmacCache || lastServerSeed !== serverSeed) {
    hmacCache = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, serverSeed);
    lastServerSeed = serverSeed;
  }
  return hmacCache;
}

function generateFloatOrig(serverSeed, clientSeed, nonce, cursor) {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  const hash = CryptoJS.HmacSHA256(message, serverSeed).toString(CryptoJS.enc.Hex);
  const slice = hash.slice(0, 8);
  const int = parseInt(slice, 16);
  return int / 4294967296;
}

function generateFloatOpt(serverSeed, clientSeed, nonce, cursor) {
  const message = `${clientSeed}:${nonce}:${cursor}`;
  const hmac = getHmac(serverSeed);
  hmac.reset();
  hmac.update(message);
  const hash = hmac.finalize();
  return (hash.words[0] >>> 0) / 4294967296;
}

function validateMinesStateOrig(serverSeed, clientSeed, nonce, targetPattern, mineCount, totalCells) {
  const cells = Array.from({ length: totalCells }, (_, i) => i);
  let cursor = 0;
  const targetSet = new Set(targetPattern);

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const float = generateFloatOrig(serverSeed, clientSeed, nonce, cursor);
    cursor++;
    const j = Math.floor(float * (i + 1));
    const temp = cells[i];
    cells[i] = cells[j];
    cells[j] = temp;

    if (targetSet.has(cells[i])) {
      return false;
    }
  }

  return true;
}

function validateMinesStateOpt(serverSeed, clientSeed, nonce, targetPattern, mineCount, totalCells) {
  // We can also optimize the array instantiation and swapping
  const cells = Array.from({ length: totalCells }, (_, i) => i);
  let cursor = 0;
  const targetSet = new Set(targetPattern);
  const hmac = getHmac(serverSeed);

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    // float = generateFloatOpt
    const message = `${clientSeed}:${nonce}:${cursor}`;
    cursor++;
    hmac.reset();
    hmac.update(message);
    const hash = hmac.finalize();
    const float = (hash.words[0] >>> 0) / 4294967296;

    const j = Math.floor(float * (i + 1));
    const temp = cells[i];
    cells[i] = cells[j];
    cells[j] = temp;

    if (targetSet.has(cells[i])) {
      return false;
    }
  }

  return true;
}

function validateMinesStateOpt2(serverSeed, clientSeed, nonce, targetSet, mineCount, totalCells, cells) {
  // Re-use arrays/sets from outer loop
  // Reset array
  for (let k = 0; k < totalCells; k++) cells[k] = k;
  let cursor = 0;
  const hmac = getHmac(serverSeed);

  for (let i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
    const message = `${clientSeed}:${nonce}:${cursor}`;
    cursor++;
    hmac.reset();
    hmac.update(message);
    const hash = hmac.finalize();
    const float = (hash.words[0] >>> 0) / 4294967296;

    const j = Math.floor(float * (i + 1));
    const temp = cells[i];
    cells[i] = cells[j];
    cells[j] = temp;

    if (targetSet.has(cells[i])) {
      return false;
    }
  }

  return true;
}

const ss = "my-server-seed";
const cs = "my-client-seed";
const targetPattern = [0, 1, 2, 3];
const targetSet = new Set(targetPattern);
const cellsArr = new Array(25);

console.time("Orig Mines");
for(let i=0; i<10000; i++) { validateMinesStateOrig(ss, cs, i, targetPattern, 3, 25); }
console.timeEnd("Orig Mines");

console.time("Opt Mines");
for(let i=0; i<10000; i++) { validateMinesStateOpt(ss, cs, i, targetPattern, 3, 25); }
console.timeEnd("Opt Mines");

console.time("Opt2 Mines");
for(let i=0; i<10000; i++) { validateMinesStateOpt2(ss, cs, i, targetSet, 3, 25, cellsArr); }
console.timeEnd("Opt2 Mines");
