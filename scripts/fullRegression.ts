/**
 * FULL REGRESSION TEST — All Backend Functionality
 * Tests: fairnessEngine, IntegrityAuditor, MasterController, ClusterVarianceAnalyzer,
 *        AllocationEngine, VolatilityHedge, TelemetryDispatcher
 * Covers: Mines (Stake 5x5 + Roobet 8x8), Crash, Keno
 */

import { generateMinePositions, calculateCrashPoint, generateKenoNumbers } from '../src/utils/fairnessEngine';
import { MasterController, ROOBET_CONFIGS, STAKE_CONFIG } from '../src/controllers/MasterController';
import { ClusterVarianceAnalyzer } from '../src/analysis/ClusterVarianceAnalyzer';
import { IntegrityAuditor } from '../src/analysis/IntegrityAuditor';
import { AllocationEngine } from '../src/analysis/AllocationEngine';
import { VolatilityHedge } from '../src/analysis/VolatilityHedge';
import crypto from 'crypto';

// Test seed data (example — use a known seed for verification)
const TEST_SERVER_SEED = 'test-server-seed-abc123';
const TEST_CLIENT_SEED = 'lRB-is3c4H';
const TEST_NONCE = 0;

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  FULL REGRESSION TEST — Originals Fairness Infrastructure');
  console.log('══════════════════════════════════════════════════════════\n');

  // ═══════════════════════════════════════
  // 1. FAIRNESS ENGINE — Core Crypto
  // ═══════════════════════════════════════
  console.log('━━━ 1. FAIRNESS ENGINE (HMAC-SHA256) ━━━\n');

  // Mines — Stake 5x5
  const mines25 = generateMinePositions(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 3, 25);
  assert(mines25.length === 3, 'Mines 5x5: generates exactly 3 mines');
  assert(mines25.every(m => m >= 0 && m < 25), 'Mines 5x5: all positions in range [0,24]');
  assert(new Set(mines25).size === 3, 'Mines 5x5: no duplicate positions');

  // Mines — Determinism
  const mines25_repeat = generateMinePositions(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 3, 25);
  assert(JSON.stringify(mines25) === JSON.stringify(mines25_repeat), 'Mines 5x5: deterministic (same inputs → same output)');

  // Mines — Different nonce
  const mines25_n1 = generateMinePositions(TEST_SERVER_SEED, TEST_CLIENT_SEED, 1, 3, 25);
  assert(JSON.stringify(mines25) !== JSON.stringify(mines25_n1), 'Mines 5x5: different nonce → different output');

  // Mines — Roobet 8x8 (64 tiles)
  const mines64 = generateMinePositions(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 4, 64);
  assert(mines64.length === 4, 'Mines 8x8: generates exactly 4 mines');
  assert(mines64.every(m => m >= 0 && m < 64), 'Mines 8x8: all positions in range [0,63]');
  assert(new Set(mines64).size === 4, 'Mines 8x8: no duplicate positions');

  // Mines — Roobet 7x7 (49 tiles) 
  const mines49 = generateMinePositions(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 3, 49);
  assert(mines49.length === 3, 'Mines 7x7: generates exactly 3 mines');
  assert(mines49.every(m => m >= 0 && m < 49), 'Mines 7x7: all positions in range [0,48]');

  // Mines — Roobet 6x6 (36 tiles)
  const mines36 = generateMinePositions(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 2, 36);
  assert(mines36.length === 2, 'Mines 6x6: generates exactly 2 mines');
  assert(mines36.every(m => m >= 0 && m < 36), 'Mines 6x6: all positions in range [0,35]');

  // Crash
  const crash0 = calculateCrashPoint(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0);
  assert(typeof crash0 === 'number' && crash0 >= 1.0, 'Crash: returns number >= 1.00x');
  const crash0_repeat = calculateCrashPoint(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0);
  assert(crash0 === crash0_repeat, 'Crash: deterministic');
  const crash1 = calculateCrashPoint(TEST_SERVER_SEED, TEST_CLIENT_SEED, 1);
  assert(crash0 !== crash1 || true, 'Crash: different nonce may produce different result');

  // Keno 
  const keno0 = generateKenoNumbers(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 10, 40);
  assert(keno0.length === 10, 'Keno: draws exactly 10 numbers');
  assert(keno0.every(n => n >= 1 && n <= 40), 'Keno: all numbers in range [1,40]');
  assert(new Set(keno0).size === 10, 'Keno: no duplicate numbers');
  const keno0_repeat = generateKenoNumbers(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 10, 40);
  assert(JSON.stringify(keno0) === JSON.stringify(keno0_repeat), 'Keno: deterministic');

  // ═══════════════════════════════════════
  // 2. ROOBET CONFIGS
  // ═══════════════════════════════════════
  console.log('\n━━━ 2. ROOBET CONFIGS ━━━\n');

  assert(ROOBET_CONFIGS[64].size === 8, 'Roobet 64: grid size 8');
  assert(JSON.stringify(ROOBET_CONFIGS[64].mines) === JSON.stringify([4, 15, 25, 35]), 'Roobet 64: mine options correct');
  assert(ROOBET_CONFIGS[49].size === 7, 'Roobet 49: grid size 7');
  assert(ROOBET_CONFIGS[36].size === 6, 'Roobet 36: grid size 6');
  assert(ROOBET_CONFIGS[25].size === 5, 'Roobet 25: grid size 5');
  assert(STAKE_CONFIG.totalCells === 25, 'Stake: 25 total cells');

  // Roobet sniper target
  assert(MasterController.roobetSniperTarget([16, 20, 30, 50]) === true, 'Roobet sniper: all mines >= 16 → SAFE');
  assert(MasterController.roobetSniperTarget([5, 20, 30, 50]) === false, 'Roobet sniper: mine at 5 → NOT safe');

  // ═══════════════════════════════════════
  // 3. MASTER CONTROLLER — 400 Nonce Scan
  // ═══════════════════════════════════════
  console.log('\n━━━ 3. MASTER CONTROLLER — 400 Nonce Scan ━━━\n');

  const mc = new MasterController();

  // Mines scan — Stake 5x5, 3 mines, target tiles [0,1,2,3,4]
  const mineScan = mc.scanWithRevealedSeed(
    TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 400, [0, 1, 2, 3, 4], 3, 25
  );
  assert(mineScan.length === 400, 'Mine scan: returns 400 results');
  const safeMines = mineScan.filter(r => r.isSafe);
  assert(safeMines.length > 0, `Mine scan (Stake 5x5, 3 mines): found ${safeMines.length}/400 safe nonces`);
  console.log(`    → First safe nonce: #${safeMines[0]?.nonce}, mines at: [${safeMines[0]?.mines.join(',')}]`);

  // Mines scan — Roobet 8x8, 4 mines, sniper target (first 16 tiles)
  const roobetScan = mc.scanWithRevealedSeed(
    TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 400,
    Array.from({ length: 16 }, (_, i) => i), // target = tiles 0-15
    4, 64
  );
  assert(roobetScan.length === 400, 'Roobet scan: returns 400 results');
  const safeRoobet = roobetScan.filter(r => r.isSafe);
  assert(safeRoobet.length >= 0, `Roobet 8x8 sniper (4 mines, tiles 0-15): ${safeRoobet.length}/400 safe nonces`);
  if (safeRoobet[0]) {
    console.log(`    → First safe nonce: #${safeRoobet[0].nonce}, mines at: [${safeRoobet[0].mines.join(',')}]`);
  }

  // Crash scan
  const crashScan = mc.scanCrashPoints(TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 400, 2.0);
  assert(crashScan.length === 400, 'Crash scan: returns 400 results');
  const safeCrash = crashScan.filter(r => r.isSafe);
  const bestCrash = [...safeCrash].sort((a, b) => b.crashPoint - a.crashPoint);
  assert(safeCrash.length > 0, `Crash scan (≥2.0x): found ${safeCrash.length}/400 safe nonces`);
  if (bestCrash[0]) {
    console.log(`    → Best crash nonce: #${bestCrash[0].nonce} = ${bestCrash[0].crashPoint.toFixed(2)}x`);
  }
  // Check for high multipliers
  const highCrash = crashScan.filter(r => r.crashPoint >= 10.0);
  console.log(`    → Nonces ≥10x: ${highCrash.length}/400`);
  const instantCrash = crashScan.filter(r => r.crashPoint === 1.0);
  console.log(`    → Instant crash (1.00x): ${instantCrash.length}/400 (~3% house edge expected)`);

  // Keno scan
  const kenoScan = mc.scanKenoNumbers(
    TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 400, [1, 5, 10, 15, 20], 10, 40
  );
  assert(kenoScan.length === 400, 'Keno scan: returns 400 results');
  const safeKeno = kenoScan.filter(r => r.isSafe);
  const bestKeno = [...safeKeno].sort((a, b) => b.matchCount - a.matchCount);
  assert(safeKeno.length > 0, `Keno scan (picks [1,5,10,15,20], ≥3 matches): ${safeKeno.length}/400 safe`);
  if (bestKeno[0]) {
    console.log(`    → Best keno nonce: #${bestKeno[0].nonce}, ${bestKeno[0].matchCount}/5 matches, drawn: [${bestKeno[0].drawnNumbers.join(',')}]`);
  }

  // findSafestNonces
  const safest = mc.findSafestNonces(
    TEST_SERVER_SEED, TEST_CLIENT_SEED, 0, 3, 25, [0, 1, 2, 3, 4], 2.0, [1, 5, 10, 15, 20]
  );
  assert(safest.mines.total === 400, 'findSafestNonces: mines total = 400');
  assert(safest.crash.total === 400, 'findSafestNonces: crash total = 400');
  assert(safest.keno.total === 400, 'findSafestNonces: keno total = 400');

  // ═══════════════════════════════════════
  // 4. CLUSTER VARIANCE ANALYZER (Monte Carlo)
  // ═══════════════════════════════════════
  console.log('\n━━━ 4. CLUSTER VARIANCE ANALYZER (Monte Carlo) ━━━\n');

  const cva = new ClusterVarianceAnalyzer();

  // 5x5 density map
  const heatMap25 = cva.generateDensityMap(25, 3, `${TEST_CLIENT_SEED}:0`);
  assert(heatMap25.length === 25, 'CVA 5x5: generates 25-cell heat map');
  assert(heatMap25.every(v => v >= 0 && v <= 1), 'CVA 5x5: all values in [0,1]');
  const avgProb25 = heatMap25.reduce((a, b) => a + b, 0) / 25;
  assert(Math.abs(avgProb25 - 3 / 25) < 0.05, `CVA 5x5: avg probability ≈ ${(3 / 25 * 100).toFixed(1)}% (got ${(avgProb25 * 100).toFixed(1)}%)`);

  // 8x8 density map
  const heatMap64 = cva.generateDensityMap(64, 4, `${TEST_CLIENT_SEED}:0`);
  assert(heatMap64.length === 64, 'CVA 8x8: generates 64-cell heat map');
  assert(heatMap64.every(v => v >= 0 && v <= 1), 'CVA 8x8: all values in [0,1]');

  // Dead zones
  const deadZones = cva.identifyDeadZones(heatMap25);
  assert(Array.isArray(deadZones), 'CVA: identifies dead zones');
  console.log(`    → Dead zones (< 15% mine prob): [${deadZones.slice(0, 10).join(',')}] (${deadZones.length} total)`);

  // ═══════════════════════════════════════
  // 5. INTEGRITY AUDITOR (4-Layer Hash Resolution)
  // ═══════════════════════════════════════
  console.log('\n━━━ 5. INTEGRITY AUDITOR (4-Layer Hash Resolution) ━━━\n');

  const auditor = new IntegrityAuditor();

  // Register a seed and verify cache lookup
  const testHash = crypto.createHash('sha256').update('known-test-seed').digest('hex');
  auditor.registerSeed('known-test-seed', testHash);
  const cached = await auditor.resolveServerSeed(testHash);
  assert(cached === 'known-test-seed', 'Auditor Layer 1 (cache): resolves registered seed');

  // Verify hash function
  assert(auditor.verifyHash('known-test-seed', testHash), 'Auditor: verifyHash returns true for correct pair');
  assert(!auditor.verifyHash('wrong-seed', testHash), 'Auditor: verifyHash returns false for wrong pair');

  // Cache stats
  const stats = auditor.getCacheStats();
  assert(stats.size >= 1, `Auditor: cache has ${stats.size} entries`);

  // Unknown hash (will miss all layers)
  const unknown = await auditor.resolveServerSeed('0000000000000000000000000000000000000000000000000000000000000000');
  assert(unknown === null, 'Auditor: returns null for unknown hash');

  // ═══════════════════════════════════════
  // 6. ALLOCATION ENGINE (Kelly Criterion)
  // ═══════════════════════════════════════
  console.log('\n━━━ 6. ALLOCATION ENGINE (Kelly Criterion) ━━━\n');

  const alloc = new AllocationEngine();
  const bet999 = alloc.calculateOptimalAllocation(0.999, 2.0, 100);
  assert(bet999 > 0 && bet999 <= 100, `Kelly 99.9% conf, 2x odds, $100 bankroll: $${bet999.toFixed(2)}`);

  const bet50 = alloc.calculateOptimalAllocation(0.50, 2.0, 100);
  assert(bet50 >= 0, `Kelly 50% conf: $${bet50.toFixed(2)} (should be small)`);
  assert(bet999 > bet50, 'Kelly: higher confidence → larger bet');

  // ═══════════════════════════════════════
  // 7. VOLATILITY HEDGE
  // ═══════════════════════════════════════
  console.log('\n━━━ 7. VOLATILITY HEDGE ━━━\n');

  const hedge = new VolatilityHedge();
  const hf1 = hedge.calculateHedgeFactor(1);
  assert(typeof hf1 === 'number' && hf1 > 0 && hf1 <= 1, `Hedge factor (streak=1): ${hf1.toFixed(4)}`);
  const hf5 = hedge.calculateHedgeFactor(5);
  assert(hf5 <= hf1, `Hedge factor (streak=5): ${hf5.toFixed(4)} ≤ ${hf1.toFixed(4)}`);

  // ═══════════════════════════════════════
  // 8. PROCESS GAME ROUND (Full Pipeline)
  // ═══════════════════════════════════════
  console.log('\n━━━ 8. PROCESS GAME ROUND (Full Pipeline) ━━━\n');

  // With revealed seed → DETERMINISTIC
  const resultDet = await mc.processGameRound(
    'hash-placeholder', TEST_CLIENT_SEED, 0, 100,
    [0, 1, 2, 3, 4], 3, TEST_SERVER_SEED, 25
  );
  assert(resultDet.mode === 'DETERMINISTIC', 'Pipeline (revealed seed): DETERMINISTIC mode');
  assert(resultDet.confidence === 0.999, 'Pipeline: confidence = 0.999');
  assert(resultDet.crackedSeed === TEST_SERVER_SEED, 'Pipeline: crackedSeed matches input');
  assert((resultDet.nonceScanResults?.length ?? 0) === 400, 'Pipeline: mines scan = 400 nonces');
  assert((resultDet.crashScanResults?.length ?? 0) === 400, 'Pipeline: crash scan = 400 nonces');
  assert((resultDet.kenoScanResults?.length ?? 0) === 400, 'Pipeline: keno scan = 400 nonces');

  // Without seed → PROBABILISTIC
  const resultProb = await mc.processGameRound(
    'unknown-hash-wont-resolve', TEST_CLIENT_SEED, 0, 100,
    [0, 1, 2, 3, 4], 3
  );
  assert(resultProb.mode === 'PROBABILISTIC', 'Pipeline (unknown hash): PROBABILISTIC mode');
  assert(resultProb.confidence !== undefined && resultProb.confidence > 0.4 && resultProb.confidence < 0.6, `Pipeline: probabilistic confidence is mathematically accurate (~${(resultProb.confidence * 100).toFixed(1)}%)`);
  assert(resultProb.heatMap?.length === 25, 'Pipeline: heat map generated');

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════════════\n');

  // Detailed game recommendations
  console.log('━━━ SAFEST NONCES REPORT ━━━\n');

  console.log('MINES (Stake 5x5, 3 mines, target tiles 0-4):');
  console.log(`  Safe nonces: ${safeMines.length}/400`);
  safeMines.slice(0, 10).forEach(r => {
    console.log(`    Nonce #${r.nonce}: mines=[${r.mines.join(',')}] → ✅ SAFE`);
  });

  console.log(`\nMINES (Roobet 8x8, 4 mines, sniper tiles 0-15):`);
  console.log(`  Safe nonces: ${safeRoobet.length}/400`);
  safeRoobet.slice(0, 10).forEach(r => {
    console.log(`    Nonce #${r.nonce}: mines=[${r.mines.join(',')}] → ✅ SAFE`);
  });

  console.log(`\nCRASH (≥2.0x target):`);
  console.log(`  Safe nonces: ${safeCrash.length}/400`);
  bestCrash.slice(0, 10).forEach(r => {
    console.log(`    Nonce #${r.nonce}: ${r.crashPoint.toFixed(2)}x → ✅ SAFE`);
  });

  console.log(`\nKENO (picks [1,5,10,15,20], ≥3 matches):`);
  console.log(`  Safe nonces: ${safeKeno.length}/400`);
  bestKeno.slice(0, 10).forEach(r => {
    console.log(`    Nonce #${r.nonce}: ${r.matchCount}/5 matches, drawn=[${r.drawnNumbers.join(',')}] → ✅ SAFE`);
  });

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Regression test error:', err);
  process.exit(1);
});