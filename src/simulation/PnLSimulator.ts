import { UHFWorkerPool } from '../workers/workerPool';
import { AllocationEngine } from '../analysis/AllocationEngine';
import { VolatilityHedge } from '../analysis/VolatilityHedge';
import { BetHistoryRecord } from '../data/SeedHarvester';

export class PnLSimulator {
  private pool: UHFWorkerPool;
  private allocation: AllocationEngine;
  private hedge: VolatilityHedge;
  private history: number[] = [];

  constructor() {
    this.pool = new UHFWorkerPool();
    this.allocation = new AllocationEngine();
    this.hedge = new VolatilityHedge();
  }

  async runBacktest(dataset: BetHistoryRecord[]): Promise<{
    finalPnL: number;
    successRate: number;
    totalGames: number;
    maxDrawdown: number;
  }> {
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let wins = 0;

    for (const record of dataset) {
      const hedgeFactor = this.hedge.calculateHedgeFactor(this.history.length > 0 ? this.history[this.history.length - 1] : 1);
      const alloc = this.allocation.calculateOptimalAllocation(0.85, 2.0, 100) * hedgeFactor;

      const result = await this.pool.executeExhaustiveScan(0, 100, record.serverSeed, record.clientSeed, [0,1,2,3,4]);

      if (result.found) {
        equity += alloc * record.payoutMultiplier;
        wins++;
        this.history.push(1);
      } else {
        equity -= alloc;
        this.history.push(0);
      }

      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
    }

    return {
      finalPnL: equity,
      successRate: (wins / dataset.length) * 100,
      totalGames: dataset.length,
      maxDrawdown
    };
  }
}
