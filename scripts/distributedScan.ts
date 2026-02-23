#!/usr/bin/env npx tsx
/**
 * Distributed Nonce Scanner — CLI entry point
 *
 * Scans a chunk of nonces for "golden" nonces where all target tiles are safe.
 * Used by the GitHub Actions distributed workflow (brute_force_distributed.yml).
 *
 * Usage:
 *   npx tsx scripts/distributedScan.ts \
 *     --serverSeed <hex> --clientSeed <str> \
 *     --startNonce 0 --endNonce 25000 \
 *     --mineCount 3 --totalCells 25 --targetTiles "0,1,2,3,4"
 */

import { generateMinePositions } from '../src/utils/fairnessEngine'
import { writeFileSync } from 'fs'

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function getArg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1 || idx + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback
    console.error(`Missing required argument: --${name}`)
    process.exit(1)
  }
  return process.argv[idx + 1]
}

const serverSeed = getArg('serverSeed')
const clientSeed = getArg('clientSeed')
const startNonce = parseInt(getArg('startNonce', '0'), 10)
const endNonce = parseInt(getArg('endNonce', '100'), 10)
const mineCount = parseInt(getArg('mineCount', '3'), 10)
const totalCells = parseInt(getArg('totalCells', '25'), 10)
const targetTiles = getArg('targetTiles', '0,1,2,3,4')
  .split(',')
  .map(s => parseInt(s.trim(), 10))
  .filter(n => !isNaN(n))

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
console.log(`[DistributedScan] Scanning nonces ${startNonce}..${endNonce}`)
console.log(`  serverSeed: ${serverSeed.substring(0, 16)}...`)
console.log(`  clientSeed: ${clientSeed}`)
console.log(`  mineCount: ${mineCount}, totalCells: ${totalCells}`)
console.log(`  targetTiles: [${targetTiles.join(', ')}]`)

const golden: Array<{ nonce: number; mines: number[]; safeTiles: number[] }> = []
const reportInterval = 10000

for (let n = startNonce; n < endNonce; n++) {
  const mines = generateMinePositions(serverSeed, clientSeed, n, mineCount, totalCells)
  const allSafe = !targetTiles.some(t => mines.includes(t))

  if (allSafe) {
    const safeTiles = Array.from({ length: totalCells }, (_, i) => i).filter(i => !mines.includes(i))
    golden.push({ nonce: n, mines, safeTiles })
  }

  if ((n - startNonce) % reportInterval === 0 && n > startNonce) {
    const pct = (((n - startNonce) / (endNonce - startNonce)) * 100).toFixed(1)
    console.log(`  [${pct}%] Scanned ${n - startNonce} nonces, ${golden.length} golden found`)
  }
}

const total = endNonce - startNonce
console.log(`\n[DistributedScan] Complete: ${total} nonces scanned, ${golden.length} golden found`)

if (golden.length > 0) {
  console.log(`  First 5 golden nonces: ${golden.slice(0, 5).map(g => `#${g.nonce}`).join(', ')}`)
}

// Write results to file for artifact upload
const output = {
  startNonce,
  endNonce,
  scanned: total,
  mineCount,
  totalCells,
  targetTiles,
  golden,
}

writeFileSync('scan-results.json', JSON.stringify(output, null, 2))
console.log(`Results written to scan-results.json`)
