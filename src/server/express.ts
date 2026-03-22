/**
 * Express API Bridge — Headless endpoint for Nonce Scanning
 *
 * Provides REST endpoints for:
 *   POST /aim/mines    — Scan for safe nonces (mines)
 *   POST /aim/keno     — Scan for high-hit nonces (keno)
 *   POST /aim/crash    — Scan for favorable crash multipliers
 *   GET  /health       — Liveness check
 *
 * Usage:
 *   npx tsx src/server/express.ts
 *   PORT=4000 npx tsx src/server/express.ts
 */

import express from 'express'
import {
  generateMinePositions,
  generateKenoNumbers,
  calculateCrashPoint,
} from '../utils/fairnessEngine'

const app = express()
// Inline CORS middleware (avoids separate 'cors' package dependency)
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  // COOP/COEP — required for SharedArrayBuffer in worker pool
  res.header('Cross-Origin-Opener-Policy', 'same-origin')
  res.header('Cross-Origin-Embedder-Policy', 'require-corp')
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})
app.use(express.json())

const PORT = parseInt(process.env.PORT || '3737', 10)
const DEFAULT_LOOK_AHEAD = 100
const MAX_LOOK_AHEAD = 10000

// ---------------------------------------------------------------------------
// POST /aim/mines
// Body: { serverSeed, clientSeed, nonce, targetTiles, mineCount?, totalCells?, lookAhead? }
// ---------------------------------------------------------------------------
app.post('/aim/mines', (req, res) => {
  const {
    serverSeed,
    clientSeed,
    nonce,
    targetTiles,
    mineCount = 3,
    totalCells = 25,
    lookAhead = DEFAULT_LOOK_AHEAD,
  } = req.body

  if (!serverSeed || !clientSeed || nonce == null || !Array.isArray(targetTiles)) {
    return res.status(400).json({ error: 'Missing required fields: serverSeed, clientSeed, nonce, targetTiles' })
  }

  const cap = Math.min(lookAhead, MAX_LOOK_AHEAD)
  const golden: Array<{ nonce: number; mines: number[]; safeTiles: number[] }> = []

  // ⚡ Bolt: Cache set and array allocation outside the loop to reduce redundant allocations
  const targetTilesSet = new Set(targetTiles)
  const allCells = Array.from({ length: totalCells }, (_, i) => i)

  for (let n = nonce; n < nonce + cap; n++) {
    const mines = generateMinePositions(serverSeed, clientSeed, n, mineCount, totalCells)
    // ⚡ Bolt: Use Set.has instead of Array.includes to reduce search complexity from O(N) to O(1)
    const allSafe = !mines.some((m: number) => targetTilesSet.has(m))
    if (allSafe) {
      // ⚡ Bolt: Use cached allCells array
      const safeTiles = allCells.filter(i => !mines.includes(i))
      golden.push({ nonce: n, mines, safeTiles })
    }
  }

  return res.json({
    mode: 'DETERMINISTIC',
    scanned: cap,
    found: golden.length,
    results: golden,
  })
})

// ---------------------------------------------------------------------------
// POST /aim/keno
// Body: { serverSeed, clientSeed, nonce, playerPicks, drawCount?, maxNum?, lookAhead? }
// ---------------------------------------------------------------------------
app.post('/aim/keno', (req, res) => {
  const {
    serverSeed,
    clientSeed,
    nonce,
    playerPicks,
    drawCount = 10,
    maxNum = 40,
    lookAhead = DEFAULT_LOOK_AHEAD,
  } = req.body

  if (!serverSeed || !clientSeed || nonce == null || !Array.isArray(playerPicks)) {
    return res.status(400).json({ error: 'Missing required fields: serverSeed, clientSeed, nonce, playerPicks' })
  }

  const cap = Math.min(lookAhead, MAX_LOOK_AHEAD)
  const results: Array<{ nonce: number; drawn: number[]; hits: number[]; hitCount: number }> = []

  // ⚡ Bolt: Cache Set outside loop to reduce redundant allocations
  const playerPicksSet = new Set(playerPicks)

  for (let n = nonce; n < nonce + cap; n++) {
    const drawn = generateKenoNumbers(serverSeed, clientSeed, n, drawCount, maxNum)
    // ⚡ Bolt: Use Set.has instead of Array.includes to reduce search complexity from O(N) to O(1)
    const hits = drawn.filter((d: number) => playerPicksSet.has(d))
    results.push({ nonce: n, drawn, hits, hitCount: hits.length })
  }

  // Sort by hit count descending
  results.sort((a, b) => b.hitCount - a.hitCount)

  return res.json({
    mode: 'DETERMINISTIC',
    scanned: cap,
    bestHitCount: results[0]?.hitCount ?? 0,
    results: results.slice(0, 20), // Top 20
  })
})

// ---------------------------------------------------------------------------
// POST /aim/crash
// Body: { serverSeed, clientSeed, nonce, targetMultiplier?, lookAhead? }
// ---------------------------------------------------------------------------
app.post('/aim/crash', (req, res) => {
  const {
    serverSeed,
    clientSeed,
    nonce,
    targetMultiplier = 2.0,
    lookAhead = DEFAULT_LOOK_AHEAD,
  } = req.body

  if (!serverSeed || !clientSeed || nonce == null) {
    return res.status(400).json({ error: 'Missing required fields: serverSeed, clientSeed, nonce' })
  }

  const cap = Math.min(lookAhead, MAX_LOOK_AHEAD)
  const golden: Array<{ nonce: number; multiplier: number }> = []

  for (let n = nonce; n < nonce + cap; n++) {
    const multiplier = calculateCrashPoint(serverSeed, clientSeed, n)
    if (multiplier >= targetMultiplier) {
      golden.push({ nonce: n, multiplier })
    }
  }

  return res.json({
    mode: 'DETERMINISTIC',
    scanned: cap,
    found: golden.length,
    targetMultiplier,
    results: golden,
  })
})

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[Express API Bridge] Listening on http://localhost:${PORT}`)
  console.log(`  POST /aim/mines   — Scan for safe nonces (mines)`)
  console.log(`  POST /aim/keno    — Scan for high-hit nonces (keno)`)
  console.log(`  POST /aim/crash   — Scan for crash multipliers`)
  console.log(`  GET  /health      — Liveness check`)
})
