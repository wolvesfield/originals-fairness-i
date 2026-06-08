import CryptoJS from 'crypto-js';

const message = 'client:1';
const serverSeed = 'seed1';
const hash = CryptoJS.HmacSHA256(message, serverSeed);
const hashStr = hash.toString(CryptoJS.enc.Hex);

const w0 = hash.words[0] >>> 0;
const w1 = hash.words[1] >>> 12; // top 20 bits

console.log('Hex:', hashStr.slice(0, 13));
console.log('Int old:', parseInt(hashStr.slice(0, 13), 16));
console.log('Int new:', w0 * 1048576 + w1);
