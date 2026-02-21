import { IntegrityAuditor } from '../analysis/IntegrityAuditor';
import { ClusterVarianceAnalyzer } from '../analysis/ClusterVarianceAnalyzer';
import { AllocationEngine } from '../analysis/AllocationEngine';
import { VolatilityHedge } from '../analysis/VolatilityHedge';
import { TelemetryDispatcher } from '../telemetry/TelemetryDispatcher';

export interface GameRoundResult {
  mode: 'DETERMINISTIC' | 'PROBABILISTIC';
  found: boolean;
  nonce?: number;
  safePath?: number[];
  confidence: number;
  allocation: number;
  heatMap?: number[];
  crackedSeed?: string;
}

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

  async processGameRound(
    serverHash: string,
    clientSeed: string,
    nonce: number,
    bankroll: number,
    targetPattern: number[] = [0, 1, 2, 3, 4]
  ): Promise<GameRoundResult> {
    // Step 1: Attempt hash resolution via IntegrityAuditor
    const crackedSeed = await this.auditor.resolveServerSeed(serverHash);

    if (crackedSeed) {
      // DETERMINISTIC MODE — seed is cracked, we know everything
      const { found, goldNonce, safePath } = this.scanNonces(
        crackedSeed, clientSeed, nonce, 100, targetPattern
      );

      if (found) {
        const alloc = this.allocation.calculateOptimalAllocation(0.999, 2.0, bankroll);
        await this.telemetry.dispatchSignal({
          confidence: 0.999,
          allocation: alloc,
          targetZone: `DETERMINISTIC Nonce #${goldNonce}`,
          volatilitySigma: 0
        });
        return {
          mode: 'DETERMINISTIC',
          found: true,
          nonce: goldNonce,
          safePath,
          confidence: 0.999,
          allocation: alloc,
          crackedSeed
        };
      }

      return {
        mode: 'DETERMINISTIC',
        found: false,
        confidence: 0,
        allocation: 0,
        crackedSeed
      };
    }

    // PROBABILISTIC MODE — Monte Carlo fallback
    const heatMap = this.cva.generateDensityMap(25, 3, `${clientSeed}:${nonce}`);
    const deadZones = this.cva.identifyDeadZones(heatMap);
    const target = deadZones.slice(0, 5);

    const hedgeFactor = this.hedge.calculateHedgeFactor(1);
    const confidence = 0.75;
    const alloc = this.allocation.calculateOptimalAllocation(confidence, 2.0, bankroll) * hedgeFactor;

    if (confidence >= 0.92) {
      await this.telemetry.dispatchSignal({
        confidence,
        allocation: alloc,
        targetZone: `PROBABILISTIC Dead Zones: ${target.join(',')}`,
        volatilitySigma: 1.0
      });
    }

    return {
      mode: 'PROBABILISTIC',
      found: target.length > 0,
      safePath: target,
      confidence,
      allocation: alloc,
      heatMap
    };
  }

  /**
   * Synchronous nonce scanning (main thread version for when workers unavailable)
   */
  private scanNonces(
    serverSeed: string,
    clientSeed: string,
    startNonce: number,
    lookAhead: number,
    targetPattern: number[]
  ): { found: boolean; goldNonce?: number; safePath?: number[] } {
    // Simplified main-thread scan — in production use UHFWorkerPool
    for (let n = startNonce; n < startNonce + lookAhead; n++) {
      const combined = `${clientSeed}:${n}:0`;
      // Use browser-compatible hashing when available
      const hash = this.simpleHash(combined, serverSeed);
      const mines = this.mapHashToMines(hash, 3, 25);
      const isGold = !targetPattern.some(tile => mines.includes(tile));
      if (isGold) {
        return { found: true, goldNonce: n, safePath: targetPattern };
      }
    }
    return { found: false };
  }

  private simpleHash(message: string, key: string): string {
    // Fallback hash — in production, CryptoJS or native crypto
    let hash = 0;
    const combined = key + message;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  private mapHashToMines(hash: string, mineCount: number, gridSize: number): number[] {
    const positions = Array.from({ length: gridSize }, (_, i) => i);
    const mines: number[] = [];
    let idx = 0;
    while (mines.length < mineCount && idx < 60) {
      const seg = hash.substring(idx, idx + 2);
      const ptr = parseInt(seg, 16) % positions.length;
      mines.push(positions.splice(ptr, 1)[0]);
      idx += 2;
    }
    return mines;
  }
}