/**
 * SEED INFLUENCE ANALYZER — Task 8: Seed Influence Analysis
 * Analyzes the statistical influence of client seed selection on game outcomes.
 * Chi-square uniformity, Shannon entropy, client seed rotation impact.
 */
import 'dotenv/config';
import { createHash, createHmac } from 'crypto';

export interface SeedInfluenceReport {
  totalRounds: number;
  clientSeedEntropy: number;
  serverSeedEntropy: number;
  nonceDistribution: { mean: number; stddev: number };
  mineConcentration: { hotZones: number[]; coldZones: number[]; chiSquare: number; pValue: string };
  clientSeedImpact: number;
  recommendation: string;
}

export class SeedInfluenceAnalyzer {

  analyze(rounds: Array<{ serverSeed: string; clientSeed: string; nonce: number }>): SeedInfluenceReport {
    const gridSize = 25;
    const mineCount = 3;

    // 1. Compute mine positions for all rounds
    const allMines: number[][] = rounds.map(r => {
      const hash = createHmac('sha256', r.serverSeed)
        .update(`${r.clientSeed}:${r.nonce}:0`)
        .digest('hex');
      return this.mapHashToMines(hash, mineCount, gridSize);
    });

    // 2. Mine concentration analysis (chi-square test)
    const tileFreq = new Array(gridSize).fill(0);
    allMines.forEach(mines => mines.forEach(m => tileFreq[m]++));
    const expected = (rounds.length * mineCount) / gridSize;
    const chiSquare = tileFreq.reduce((sum, obs) => sum + Math.pow(obs - expected, 2) / expected, 0);

    // df = 24, critical values: 36.42 (p<0.05), 42.98 (p<0.01)
    let pValue = 'p > 0.05 (uniform)';
    if (chiSquare > 42.98) pValue = 'p < 0.01 (NON-UNIFORM ⚠️)';
    else if (chiSquare > 36.42) pValue = 'p < 0.05 (borderline)';

    const sorted = tileFreq.map((f, i) => ({ index: i, freq: f })).sort((a, b) => b.freq - a.freq);
    const hotZones = sorted.slice(0, 5).map(s => s.index);
    const coldZones = sorted.slice(-5).map(s => s.index);

    // 3. Client seed influence: simulate same rounds with different client seeds
    const altClientSeeds = ['test1', 'test2', 'test3', 'alpha', 'beta', 'gamma', 'delta'];
    let totalDiff = 0;
    for (const alt of altClientSeeds) {
      const altMines = rounds.map(r => {
        const hash = createHmac('sha256', r.serverSeed)
          .update(`${alt}:${r.nonce}:0`)
          .digest('hex');
        return this.mapHashToMines(hash, mineCount, gridSize);
      });
      let diffs = 0;
      for (let i = 0; i < rounds.length; i++) {
        if (JSON.stringify(allMines[i].sort()) !== JSON.stringify(altMines[i].sort())) diffs++;
      }
      totalDiff += diffs / rounds.length;
    }
    const clientSeedImpact = totalDiff / altClientSeeds.length;

    // 4. Nonce distribution
    const nonces = rounds.map(r => r.nonce);
    const nonceMean = nonces.reduce((a, b) => a + b, 0) / nonces.length;
    const nonceStddev = Math.sqrt(nonces.reduce((s, n) => s + (n - nonceMean) ** 2, 0) / nonces.length);

    // 5. Shannon entropy of seeds
    const serverSeedEntropy = this.shannonEntropy(rounds.map(r => r.serverSeed));
    const clientSeedEntropy = this.shannonEntropy(rounds.map(r => r.clientSeed));

    // 6. Generate recommendation
    let rec = '';
    if (chiSquare > 36.42) rec += 'ALERT: Mine distribution fails chi-square uniformity test. ';
    else rec += 'Mine distribution appears uniform (PRNG is fair). ';
    if (clientSeedImpact > 0.95) rec += 'Client seed rotation fully changes outcomes — rotate frequently for maximum entropy. ';
    else if (clientSeedImpact > 0.5) rec += 'Client seed has moderate impact on outcomes. ';
    else rec += 'WARNING: Client seed has low impact — possible weak PRNG coupling. ';

    return {
      totalRounds: rounds.length,
      clientSeedEntropy,
      serverSeedEntropy,
      nonceDistribution: { mean: nonceMean, stddev: nonceStddev },
      mineConcentration: { hotZones, coldZones, chiSquare, pValue },
      clientSeedImpact,
      recommendation: rec.trim()
    };
  }

  private mapHashToMines(hash: string, mineCount: number, gridSize: number): number[] {
    const positions = Array.from({ length: gridSize }, (_, i) => i);
    const mines: number[] = [];
    let idx = 0;
    while (mines.length < mineCount) {
      const seg = hash.substring(idx, idx + 2);
      const ptr = parseInt(seg, 16) % positions.length;
      mines.push(positions.splice(ptr, 1)[0]);
      idx += 2;
      if (idx >= 60) {
        hash = createHash('sha256').update(hash).digest('hex');
        idx = 0;
      }
    }
    return mines;
  }

  private shannonEntropy(values: string[]): number {
    const freq = new Map<string, number>();
    values.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
    const n = values.length;
    let entropy = 0;
    freq.forEach(count => {
      const p = count / n;
      if (p > 0) entropy -= p * Math.log2(p);
    });
    return entropy;
  }
}

// CLI entry point
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('SeedInfluenceAnalyzer.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('SeedInfluenceAnalyzer.js');

if (isMain) {
  const analyzer = new SeedInfluenceAnalyzer();

  // Generate synthetic test data
  const rounds: Array<{ serverSeed: string; clientSeed: string; nonce: number }> = [];
  for (let i = 0; i < 1000; i++) {
    const serverSeed = createHash('sha256').update(`server-seed-${i}`).digest('hex');
    rounds.push({ serverSeed, clientSeed: 'test-client', nonce: i });
  }

  console.log('═══ SEED INFLUENCE ANALYSIS ═══\n');
  const report = analyzer.analyze(rounds);
  console.log(`Total Rounds: ${report.totalRounds}`);
  console.log(`Client Seed Entropy: ${report.clientSeedEntropy.toFixed(4)} bits`);
  console.log(`Server Seed Entropy: ${report.serverSeedEntropy.toFixed(4)} bits`);
  console.log(`Nonce Distribution: μ=${report.nonceDistribution.mean.toFixed(1)}, σ=${report.nonceDistribution.stddev.toFixed(1)}`);
  console.log(`Chi-Square: ${report.mineConcentration.chiSquare.toFixed(2)} (${report.mineConcentration.pValue})`);
  console.log(`Hot Zones: [${report.mineConcentration.hotZones.join(', ')}]`);
  console.log(`Cold Zones: [${report.mineConcentration.coldZones.join(', ')}]`);
  console.log(`Client Seed Impact: ${(report.clientSeedImpact * 100).toFixed(1)}%`);
  console.log(`\n📋 ${report.recommendation}`);
}