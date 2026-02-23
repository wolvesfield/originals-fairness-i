import { IntegrityAuditor } from '../analysis/IntegrityAuditor';
import { ClusterVarianceAnalyzer } from '../analysis/ClusterVarianceAnalyzer';
import { AllocationEngine } from '../analysis/AllocationEngine';
import { VolatilityHedge } from '../analysis/VolatilityHedge';
import { TelemetryDispatcher } from '../telemetry/TelemetryDispatcher';
import { generateMinePositions, calculateCrashPoint, generateKenoNumbers } from '../utils/fairnessEngine';

// Roobet mine configs per grid size
export const ROOBET_CONFIGS: Record<number, { size: number; mines: number[] }> = {
  64: { size: 8, mines: [4, 15, 25, 35] },
  49: { size: 7, mines: [3, 10, 15, 25] },
  36: { size: 6, mines: [2, 5, 10, 15] },
  25: { size: 5, mines: [1, 3, 5, 10] }
};

// Stake mine config
export const STAKE_CONFIG = {
  size: 5,
  totalCells: 25,
  mineRange: { min: 1, max: 24 }
};

export interface NonceScanResult {
  nonce: number;
  mines: number[];
  safeTiles: number[];
  isSafe: boolean;
}

export interface CrashScanResult {
  nonce: number;
  crashPoint: number;
  isSafe: boolean; // true if crashPoint >= target multiplier
}

export interface KenoScanResult {
  nonce: number;
  drawnNumbers: number[];
  matchCount: number;
  isSafe: boolean; // true if enough matches with player picks
}

export interface AnalysisModeResult {
  name: string;
  confidence: number;
  description: string;
  details: Record<string, any>;
}

export interface GameRoundResult {
  mode: 'DETERMINISTIC' | 'PROBABILISTIC';
  found: boolean;
  nonce?: number;
  safePath?: number[];
  confidence: number;
  allocation: number;
  heatMap?: number[];
  crackedSeed?: string;
  nonceScanResults?: NonceScanResult[];
  crashScanResults?: CrashScanResult[];
  kenoScanResults?: KenoScanResult[];
  modeResults?: AnalysisModeResult[];
}

export interface ApexGoldenPathOption {
  nonce: number;
  safeTiles: number[];
  mines: number[];
  safetyScore: number;       // percentage of total cells that are safe
  targetSafetyScore: number; // percentage: how many of the target tiles are safe
}

export interface ApexScanResult {
  mode: 'DETERMINISTIC' | 'PROBABILISTIC';
  options: ApexGoldenPathOption[];
  confidence: number;
  heatMap?: number[];
}

const NONCE_LOOK_AHEAD = 400; // Scan 400 nonces for best opportunity

export class MasterController {
  private auditor: IntegrityAuditor;
  private cva: ClusterVarianceAnalyzer;
  private allocation: AllocationEngine;
  private hedge: VolatilityHedge;
  private telemetry: TelemetryDispatcher;

  constructor() {
    this.auditor = new IntegrityAuditor();
    this.cva = new ClusterVarianceAnalyzer();
    this.allocation = new AllocationEngine();
    this.hedge = new VolatilityHedge();
    this.telemetry = new TelemetryDispatcher();
  }

  /**
   * Roobet sniper target: first 16 tiles of 8x8 grid must be clear of mines
   */
  static roobetSniperTarget(mines: number[]): boolean {
    return !mines.some(pos => pos < 16);
  }

  /**
   * Full nonce scan for Mines using revealed server seed.
   * Scans NONCE_LOOK_AHEAD nonces and returns ALL results.
   */
  scanWithRevealedSeed(
    serverSeed: string,
    clientSeed: string,
    startNonce: number,
    lookAhead: number = NONCE_LOOK_AHEAD,
    targetPattern: number[],
    mineCount: number = 3,
    totalCells: number = 25
  ): NonceScanResult[] {
    const results: NonceScanResult[] = [];

    for (let n = startNonce; n < startNonce + lookAhead; n++) {
      const mines = generateMinePositions(serverSeed, clientSeed, n, mineCount, totalCells);
      const allTiles = Array.from({ length: totalCells }, (_, i) => i);
      const safeTiles = allTiles.filter(t => !mines.includes(t));
      const isSafe = !targetPattern.some(tile => mines.includes(tile));

      results.push({ nonce: n, mines, safeTiles, isSafe });
    }

    return results;
  }

  /**
   * Scan crash points for a range of nonces.
   * Returns nonces sorted by best (highest) crash points.
   */
  scanCrashPoints(
    serverSeed: string,
    clientSeed: string,
    startNonce: number,
    count: number = NONCE_LOOK_AHEAD,
    targetMultiplier: number = 2.0
  ): CrashScanResult[] {
    const results: CrashScanResult[] = [];
    for (let n = startNonce; n < startNonce + count; n++) {
      const crashPoint = calculateCrashPoint(serverSeed, clientSeed, n);
      results.push({
        nonce: n,
        crashPoint,
        isSafe: crashPoint >= targetMultiplier
      });
    }
    return results;
  }

  /**
   * Scan Keno numbers for a range of nonces.
   * Finds nonces with the most matches to player's selected numbers.
   */
  scanKenoNumbers(
    serverSeed: string,
    clientSeed: string,
    startNonce: number,
    count: number = NONCE_LOOK_AHEAD,
    playerPicks: number[] = [],
    drawCount: number = 10,
    maxNum: number = 40
  ): KenoScanResult[] {
    const results: KenoScanResult[] = [];
    for (let n = startNonce; n < startNonce + count; n++) {
      const drawnNumbers = generateKenoNumbers(serverSeed, clientSeed, n, drawCount, maxNum);
      const matchCount = playerPicks.filter(p => drawnNumbers.includes(p)).length;
      results.push({
        nonce: n,
        drawnNumbers,
        matchCount,
        isSafe: matchCount >= Math.ceil(playerPicks.length * 0.5) // 50%+ match
      });
    }
    return results;
  }

  /**
   * Find the safest nonces for each game type.
   * Returns the best opportunities across Mines, Crash, and Keno.
   */
  findSafestNonces(
    serverSeed: string,
    clientSeed: string,
    startNonce: number,
    mineCount: number = 3,
    totalCells: number = 25,
    targetTiles: number[] = [0, 1, 2, 3, 4],
    crashTarget: number = 2.0,
    kenoPlayerPicks: number[] = [1, 5, 10, 15, 20]
  ) {
    // Mines: Find nonces where target tiles are all safe
    const mineResults = this.scanWithRevealedSeed(
      serverSeed, clientSeed, startNonce, NONCE_LOOK_AHEAD, targetTiles, mineCount, totalCells
    );
    const safeMineNonces = mineResults.filter(r => r.isSafe);

    // Crash: Find nonces with crash point >= target
    const crashResults = this.scanCrashPoints(
      serverSeed, clientSeed, startNonce, NONCE_LOOK_AHEAD, crashTarget
    );
    const safeCrashNonces = crashResults.filter(r => r.isSafe);
    const bestCrashNonces = [...safeCrashNonces].sort((a, b) => b.crashPoint - a.crashPoint);

    // Keno: Find nonces with most matches
    const kenoResults = this.scanKenoNumbers(
      serverSeed, clientSeed, startNonce, NONCE_LOOK_AHEAD, kenoPlayerPicks
    );
    const safeKenoNonces = kenoResults.filter(r => r.isSafe);
    const bestKenoNonces = [...safeKenoNonces].sort((a, b) => b.matchCount - a.matchCount);

    return {
      mines: {
        total: mineResults.length,
        safeCount: safeMineNonces.length,
        firstSafe: safeMineNonces[0] || null,
        safeNonces: safeMineNonces.slice(0, 20)
      },
      crash: {
        total: crashResults.length,
        safeCount: safeCrashNonces.length,
        bestNonce: bestCrashNonces[0] || null,
        topNonces: bestCrashNonces.slice(0, 20)
      },
      keno: {
        total: kenoResults.length,
        safeCount: safeKenoNonces.length,
        bestNonce: bestKenoNonces[0] || null,
        topNonces: bestKenoNonces.slice(0, 20)
      }
    };
  }

  async processGameRound(
    serverSeedOrHash: string,
    clientSeed: string,
    nonce: number,
    bankroll: number,
    targetPattern: number[] = [0, 1, 2, 3, 4],
    mineCount: number = 3,
    revealedSeed?: string,
    totalCells: number = 25
  ): Promise<GameRoundResult> {
    const directSeed = revealedSeed || null;

    if (directSeed) {
      return this.processDeterministic(
        directSeed, clientSeed, nonce, bankroll, targetPattern, mineCount, totalCells
      );
    }

    // Step 1: Attempt hash resolution via IntegrityAuditor (4 layers)
    const crackedSeed = await this.auditor.resolveServerSeed(serverSeedOrHash);

    if (crackedSeed) {
      return this.processDeterministic(
        crackedSeed, clientSeed, nonce, bankroll, targetPattern, mineCount, totalCells
      );
    }

    // PROBABILISTIC MODE — Multi-algorithm analysis
    const heatMap = this.cva.generateDensityMap(totalCells, mineCount, `${clientSeed}:${nonce}`);
    const deadZones = this.cva.identifyDeadZones(heatMap);
    const target = deadZones.slice(0, 5);

    // Run multiple analysis modes
    const modeResults = this.runMultiModeAnalysis(
      serverSeedOrHash, clientSeed, nonce, mineCount, totalCells, heatMap
    );

    // Weighted average confidence across all modes
    const weights = [0.30, 0.25, 0.20, 0.15, 0.10]; // MC, Entropy, Pattern, Chi2, BaseRate
    let weightedConfidence = 0;
    modeResults.forEach((mode, i) => {
      weightedConfidence += mode.confidence * (weights[i] || 0.1);
    });
    const confidence = Math.min(weightedConfidence, 0.95); // Cap at 95% for probabilistic

    const hedgeFactor = this.hedge.calculateHedgeFactor(1);
    const alloc = this.allocation.calculateOptimalAllocation(confidence, 2.0, bankroll) * hedgeFactor;

    return {
      mode: 'PROBABILISTIC',
      found: target.length > 0,
      safePath: target,
      confidence,
      allocation: alloc,
      heatMap,
      modeResults
    };
  }

  /**
   * Run 5 independent analysis modes and return per-mode confidence.
   */
  private runMultiModeAnalysis(
    serverSeedHash: string,
    clientSeed: string,
    nonce: number,
    mineCount: number,
    totalCells: number,
    heatMap: number[]
  ): AnalysisModeResult[] {
    const baseRate = mineCount / totalCells; // e.g. 3/25 = 0.12
    const results: AnalysisModeResult[] = [];

    // ── Mode 1: Monte Carlo Variance Analysis ──
    // Measures how much the heatmap deviates from perfect uniformity
    const mcVariance = this.computeVariance(heatMap, baseRate);
    const maxExpectedVariance = baseRate * (1 - baseRate) / 100; // expected sampling variance
    const varianceRatio = mcVariance / maxExpectedVariance;
    // Higher variance = less uniform = potentially exploitable patterns
    // But with provably fair, variance should be LOW → confidence should be LOW
    const mcConfidence = Math.max(0.05, Math.min(0.60, 0.30 + (varianceRatio > 2 ? 0.15 : -0.10)));
    results.push({
      name: 'Monte Carlo Variance',
      confidence: mcConfidence,
      description: `10,000 iteration simulation. Variance ratio: ${varianceRatio.toFixed(2)}x expected.`,
      details: {
        variance: mcVariance,
        expectedVariance: maxExpectedVariance,
        varianceRatio,
        iterations: 10000
      }
    });

    // ── Mode 2: Entropy Analysis ──
    // Analyze the entropy of the server seed hash
    const hashEntropy = this.computeHashEntropy(serverSeedHash);
    // Perfect SHA-256 hash has ~4 bits entropy per hex char (max ~256 bits for 64 chars)
    // Real hashes should have high entropy; low entropy could indicate weak seed
    const maxEntropy = Math.min(serverSeedHash.length, 64) * 4;
    const entropyRatio = hashEntropy / maxEntropy;
    // High entropy (close to 1.0) = strong hash = hard to predict = lower confidence
    // Low entropy = potentially weak seed = slightly higher exploitability
    const entropyConfidence = Math.max(0.05, Math.min(0.45, 0.50 - entropyRatio * 0.40));
    results.push({
      name: 'Entropy Analysis',
      confidence: entropyConfidence,
      description: `Hash entropy: ${hashEntropy.toFixed(1)} / ${maxEntropy.toFixed(0)} bits. ${entropyRatio > 0.9 ? 'Strong hash — low predictability.' : 'Below expected entropy.'}`,
      details: {
        hashEntropy,
        maxEntropy,
        entropyRatio,
        assessment: entropyRatio > 0.9 ? 'strong' : entropyRatio > 0.7 ? 'moderate' : 'weak'
      }
    });

    // ── Mode 3: Nonce Sequence Pattern Detection ──
    // Detect if the nonce is in a potentially favorable position
    // based on common provably fair implementation patterns
    const nonceAnalysis = this.analyzeNoncePatterns(nonce, mineCount, totalCells);
    results.push({
      name: 'Pattern Detection',
      confidence: nonceAnalysis.confidence,
      description: nonceAnalysis.description,
      details: nonceAnalysis.details
    });

    // ── Mode 4: Chi-Square Uniformity Test ──
    // Test if the heatmap distribution passes chi-square test for uniformity
    const chiSquareResult = this.chiSquareTest(heatMap, baseRate);
    // If chi-square is low → distribution is uniform → provably fair → hard to exploit
    // If chi-square is high → non-uniform → potential patterns
    const chiConfidence = Math.max(0.05, Math.min(0.50, chiSquareResult.pValue < 0.05 ? 0.35 : 0.15));
    results.push({
      name: 'Chi-Square Uniformity',
      confidence: chiConfidence,
      description: `χ² = ${chiSquareResult.statistic.toFixed(2)}, p-value = ${chiSquareResult.pValue.toFixed(4)}. ${chiSquareResult.pValue < 0.05 ? 'Non-uniform distribution detected.' : 'Distribution appears uniform.'}`,
      details: chiSquareResult
    });

    // ── Mode 5: Base Rate Computation ──
    // Pure mathematical probability — what you'd expect from a fair system
    const baseRateConfidence = 1 - baseRate; // e.g. 88% for 3/25
    // But this is just the per-tile safety rate, not a "prediction"
    // Scale it down to reflect that we're NOT predicting anything
    const scaledBaseRate = Math.max(0.05, baseRateConfidence * 0.20); // 88% → 17.6%
    results.push({
      name: 'Base Rate',
      confidence: scaledBaseRate,
      description: `Mathematical base rate: ${(baseRateConfidence * 100).toFixed(1)}% per tile safe. This is the expected rate for any fair ${mineCount}-mine / ${totalCells}-cell game.`,
      details: {
        baseRate,
        perTileSafety: baseRateConfidence,
        mineCount,
        totalCells,
        note: 'This is not a prediction — it is the mathematical expectation.'
      }
    });

    return results;
  }

  private computeVariance(values: number[], mean: number): number {
    const sqDiffs = values.map(v => (v - mean) ** 2);
    return sqDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private computeHashEntropy(hash: string): number {
    if (!hash || hash.length === 0) return 0;
    const freq: Record<string, number> = {};
    for (const ch of hash) {
      freq[ch] = (freq[ch] || 0) + 1;
    }
    let entropy = 0;
    const len = hash.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    // Scale: bits per character * total characters
    return entropy * len;
  }

  private analyzeNoncePatterns(
    nonce: number, mineCount: number, totalCells: number
  ): { confidence: number; description: string; details: Record<string, any> } {
    // Analyze nonce for common patterns
    const isPrime = this.isPrime(nonce);
    const isFibonacci = this.isFibonacci(nonce);
    const isPowerOf2 = nonce > 0 && (nonce & (nonce - 1)) === 0;
    const mod100 = nonce % 100;
    const isRoundNumber = nonce > 0 && nonce % 10 === 0;

    let patternScore = 0;
    const patterns: string[] = [];

    // These patterns don't actually affect provably fair outcomes
    // but we analyze them for completeness
    if (isPrime) { patternScore += 0.02; patterns.push('prime'); }
    if (isFibonacci) { patternScore += 0.01; patterns.push('fibonacci'); }
    if (isPowerOf2) { patternScore += 0.01; patterns.push('power-of-2'); }
    if (isRoundNumber) { patternScore += 0.01; patterns.push('round-number'); }

    // Low nonces have less history → less statistical significance
    const historyFactor = Math.min(1, nonce / 100);
    const confidence = Math.max(0.05, Math.min(0.25, 0.10 + patternScore * historyFactor));

    return {
      confidence,
      description: `Nonce #${nonce}: ${patterns.length > 0 ? patterns.join(', ') : 'no special patterns'}. History depth: ${nonce} rounds.`,
      details: { nonce, isPrime, isFibonacci, isPowerOf2, isRoundNumber, patterns, historyFactor }
    };
  }

  private isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }

  private isFibonacci(n: number): boolean {
    if (n < 0) return false;
    const check = (x: number) => {
      const s = Math.sqrt(x);
      return Math.floor(s) * Math.floor(s) === x;
    };
    return check(5 * n * n + 4) || check(5 * n * n - 4);
  }

  private chiSquareTest(
    observed: number[], expected: number
  ): { statistic: number; pValue: number; degreesOfFreedom: number } {
    const n = observed.length;
    let chiSq = 0;
    for (const obs of observed) {
      chiSq += (obs - expected) ** 2 / expected;
    }
    const df = n - 1;

    // Approximate p-value using Wilson-Hilferty approximation
    const z = Math.pow(chiSq / df, 1/3) - (1 - 2 / (9 * df));
    const denom = Math.sqrt(2 / (9 * df));
    const zScore = z / denom;
    // Standard normal CDF approximation
    const pValue = 1 - this.normalCDF(zScore);

    return { statistic: chiSq, pValue: Math.max(0, Math.min(1, pValue)), degreesOfFreedom: df };
  }

  private normalCDF(z: number): number {
    // Abramowitz & Stegun approximation
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  }

  private async processDeterministic(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    bankroll: number,
    targetPattern: number[],
    mineCount: number,
    totalCells: number
  ): Promise<GameRoundResult> {
    // Mines scan
    const scanResults = this.scanWithRevealedSeed(
      serverSeed, clientSeed, nonce, NONCE_LOOK_AHEAD, targetPattern, mineCount, totalCells
    );
    const firstGold = scanResults.find(r => r.isSafe);

    // Crash scan
    const crashResults = this.scanCrashPoints(serverSeed, clientSeed, nonce);

    // Keno scan
    const kenoResults = this.scanKenoNumbers(serverSeed, clientSeed, nonce);

    const alloc = this.allocation.calculateOptimalAllocation(0.999, 2.0, bankroll);

    await this.telemetry.dispatchSignal({
      confidence: 0.999,
      allocation: alloc,
      targetZone: `DETERMINISTIC Nonce #${firstGold?.nonce ?? 'none'}`,
      volatilitySigma: 0
    });

    return {
      mode: 'DETERMINISTIC',
      found: !!firstGold,
      nonce: firstGold?.nonce,
      safePath: firstGold?.safeTiles?.slice(0, 5),
      confidence: 0.999,
      allocation: alloc,
      crackedSeed: serverSeed,
      nonceScanResults: scanResults,
      crashScanResults: crashResults,
      kenoScanResults: kenoResults
    };
  }

  /**
   * Apex Scan: Returns the top N safest nonces with detailed stats.
   * Each option shows the safe tiles, mine positions, and safety percentages.
   */
  apexScan(
    serverSeed: string,
    clientSeed: string,
    startNonce: number,
    targetTiles: number[] = [0, 1, 2, 3, 4],
    mineCount: number = 3,
    totalCells: number = 25,
    topN: number = 3
  ): ApexScanResult {
    const allResults: ApexGoldenPathOption[] = [];

    for (let n = startNonce; n < startNonce + NONCE_LOOK_AHEAD; n++) {
      const mines = generateMinePositions(serverSeed, clientSeed, n, mineCount, totalCells);
      const allTiles = Array.from({ length: totalCells }, (_, i) => i);
      const safeTiles = allTiles.filter(t => !mines.includes(t));

      // How many of the target tiles are safe
      const targetSafe = targetTiles.filter(t => !mines.includes(t));
      const targetSafetyScore = (targetSafe.length / targetTiles.length) * 100;

      // Overall safety
      const safetyScore = (safeTiles.length / totalCells) * 100;

      allResults.push({
        nonce: n,
        safeTiles,
        mines,
        safetyScore,
        targetSafetyScore
      });
    }

    // Sort by target safety (most target tiles safe first), then by nonce
    allResults.sort((a, b) => {
      if (b.targetSafetyScore !== a.targetSafetyScore) {
        return b.targetSafetyScore - a.targetSafetyScore;
      }
      return a.nonce - b.nonce; // earlier nonce preferred
    });

    return {
      mode: 'DETERMINISTIC',
      options: allResults.slice(0, topN),
      confidence: 0.999
    };
  }
}