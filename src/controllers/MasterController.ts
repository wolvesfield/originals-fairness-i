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

    // PROBABILISTIC MODE — Monte Carlo fallback
    const heatMap = this.cva.generateDensityMap(totalCells, mineCount, `${clientSeed}:${nonce}`);
    const deadZones = this.cva.identifyDeadZones(heatMap);
    const target = deadZones.slice(0, 5);

    const hedgeFactor = this.hedge.calculateHedgeFactor(1);
    const confidence = 0.75;
    const alloc = this.allocation.calculateOptimalAllocation(confidence, 2.0, bankroll) * hedgeFactor;

    return {
      mode: 'PROBABILISTIC',
      found: target.length > 0,
      safePath: target,
      confidence,
      allocation: alloc,
      heatMap
    };
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
}