import { createHash } from 'crypto'
import { calculateCrashPoint } from '../src/utils/fairnessEngine'
import { bulkInsertVerifiedSeeds } from '../src/db/db'
import type { VerifiedSeed } from '../src/lib/types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT_SEED = 'provably_fair_audit_root_2026'
const CHAIN_LENGTH = 10_000
const CLIENT_SEED = '0000000000000000'
const BATCH_SIZE = 2_500

// ---------------------------------------------------------------------------
// Hash chain generation
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

console.log(`Generating reverse hash chain of ${CHAIN_LENGTH} seeds...`)
console.log(`Root seed: "${ROOT_SEED}"`)

const chain: string[] = new Array(CHAIN_LENGTH)
chain[CHAIN_LENGTH - 1] = ROOT_SEED

for (let i = CHAIN_LENGTH - 2; i >= 0; i--) {
  chain[i] = sha256(chain[i + 1])
}

console.log(`Chain generated. First seed (round 0): ${chain[0].slice(0, 16)}...`)
console.log(`Last seed  (round ${CHAIN_LENGTH - 1}): ${ROOT_SEED}`)

// ---------------------------------------------------------------------------
// Verify chain integrity (spot check)
// ---------------------------------------------------------------------------

const spotIndex = Math.floor(CHAIN_LENGTH / 2)
const verified = sha256(chain[spotIndex + 1]) === chain[spotIndex]
console.log(`Chain integrity (spot check at index ${spotIndex}): ${verified ? 'PASS' : 'FAIL'}`)

if (!verified) {
  console.error('Hash chain integrity check failed. Aborting.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Calculate crash points and build records
// ---------------------------------------------------------------------------

console.log('Calculating crash points for all seeds...')

const now = new Date().toISOString()
const records: VerifiedSeed[] = new Array(CHAIN_LENGTH)

for (let i = 0; i < CHAIN_LENGTH; i++) {
  const crashPoint = calculateCrashPoint(chain[i], CLIENT_SEED, 0)
  records[i] = {
    id: `baseline-${i}`,
    server_seed: chain[i],
    client_seed: CLIENT_SEED,
    nonce: i,
    game_type: 'crash',
    result_data: JSON.stringify({ crashPoint }),
    created_at: now
  }
}

// Quick stats
const crashPoints = records.map(r => JSON.parse(r.result_data).crashPoint as number)
const instantCrashes = crashPoints.filter(p => p === 1).length
const avg = crashPoints.reduce((sum, p) => sum + p, 0) / crashPoints.length
const max = Math.max(...crashPoints)

console.log(`\nBaseline Statistics:`)
console.log(`  Total rounds:    ${CHAIN_LENGTH}`)
console.log(`  Instant crashes: ${instantCrashes} (${((instantCrashes / CHAIN_LENGTH) * 100).toFixed(2)}%)`)
console.log(`  Average mult:    ${avg.toFixed(2)}x`)
console.log(`  Max mult:        ${max.toFixed(2)}x`)

// ---------------------------------------------------------------------------
// Batch insert into SQLite
// ---------------------------------------------------------------------------

console.log(`\nInserting ${CHAIN_LENGTH} records into database (batch size: ${BATCH_SIZE})...`)

const startTime = performance.now()

for (let offset = 0; offset < CHAIN_LENGTH; offset += BATCH_SIZE) {
  const batch = records.slice(offset, offset + BATCH_SIZE)
  bulkInsertVerifiedSeeds(batch)
  console.log(`  Inserted ${Math.min(offset + BATCH_SIZE, CHAIN_LENGTH)} / ${CHAIN_LENGTH}`)
}

const elapsed = performance.now() - startTime

console.log(`\nDone. ${CHAIN_LENGTH} records inserted in ${elapsed.toFixed(0)}ms (${(CHAIN_LENGTH / (elapsed / 1000)).toFixed(0)} records/sec)`)
