import CryptoJS from 'crypto-js';

/**
 * UHF Operational Brain — Enhanced for All Games
 * Handles Mines (25/36/49/64), Keno (1-40), Crash multipliers
 */
self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'SCAN_CHUNK') {
    const { startNonce, endNonce, serverSeed, clientSeed, targetPattern, gameType, gameConfig } = payload;

    for (let nonce = startNonce; nonce <= endNonce; nonce++) {
      const hash = generateHMAC(serverSeed, `${clientSeed}:${nonce}:0`);
      let isGold = false;

      switch (gameType || 'MINES') {
        case 'MINES':
          isGold = validateMinesState(hash, targetPattern, gameConfig?.mineCount || 3);
          break;
        case 'KENO':
          isGold = validateKenoState(hash, targetPattern, gameConfig?.drawCount || 10);
          break;
        case 'CRASH':
          isGold = validateCrashState(hash, gameConfig?.targetMultiplier || 2.0);
          break;
      }

      if (isGold) {
        self.postMessage({ found: true, nonce, safePath: targetPattern });
        return;
      }
    }
    self.postMessage({ found: false });
  }
};

function generateHMAC(key: string, message: string): string {
  return CryptoJS.HmacSHA256(message, key).toString(CryptoJS.enc.Hex);
}

function validateMinesState(hash: string, targetPattern: number[], mineCount: number): boolean {
  const mines = mapHashToMines(hash, mineCount, 25);
  return !targetPattern.some((tile) => mines.includes(tile));
}

function validateKenoState(hash: string, selectedNumbers: number[], drawCount: number): boolean {
  const drawn = mapHashToKenoNumbers(hash, drawCount);
  const hits = selectedNumbers.filter((n) => drawn.includes(n));
  return hits.length >= Math.ceil(selectedNumbers.length * 0.6);
}

function validateCrashState(hash: string, targetMultiplier: number): boolean {
  const multiplier = mapHashToCrashMultiplier(hash);
  return multiplier >= targetMultiplier;
}

function mapHashToMines(hash: string, mineCount: number, gridSize: number): number[] {
  const allPositions = Array.from({ length: gridSize }, (_, i) => i);
  const mines: number[] = [];
  let hashIndex = 0;

  while (mines.length < mineCount) {
    const segment = hash.substring(hashIndex, hashIndex + 2);
    const pointer = parseInt(segment, 16) % allPositions.length;
    mines.push(allPositions.splice(pointer, 1)[0]);
    hashIndex += 2;
    if (hashIndex >= 60) {
      hash = CryptoJS.SHA256(hash).toString(CryptoJS.enc.Hex);
      hashIndex = 0;
    }
  }
  return mines;
}

function mapHashToKenoNumbers(hash: string, drawCount: number): number[] {
  const allNumbers = Array.from({ length: 40 }, (_, i) => i + 1);
  const drawn: number[] = [];
  let hashIndex = 0;

  while (drawn.length < drawCount) {
    const segment = hash.substring(hashIndex, hashIndex + 2);
    const pointer = parseInt(segment, 16) % allNumbers.length;
    drawn.push(allNumbers.splice(pointer, 1)[0]);
    hashIndex += 2;
    if (hashIndex >= 60) {
      hash = CryptoJS.SHA256(hash).toString(CryptoJS.enc.Hex);
      hashIndex = 0;
    }
  }
  return drawn;
}

function mapHashToCrashMultiplier(hash: string): number {
  const h = parseInt(hash.substring(0, 13), 16);
  const e = Math.pow(2, 52);
  return Math.max(1, Math.floor((100 * e - h) / (e - h)) / 100);
}
