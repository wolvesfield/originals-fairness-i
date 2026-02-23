import { generateMinePositions } from '../utils/fairnessEngine';

/**
 * Monte Carlo Density Mapping using the REAL fairness engine algorithm.
 * Uses the same Fisher-Yates shuffle + HMAC-SHA256 float generation
 * as the actual provably fair system, ensuring accurate probability maps.
 *
 * Each simulation uses a unique simulated server seed so the distribution
 * is representative of actual mine placement behaviour.
 */
export class ClusterVarianceAnalyzer {
  private iterations = 10000; // 10k iterations, each using real algorithm

  /**
   * Generate a probability heat map showing how likely each cell is to
   * contain a mine. Values are in [0, 1] where higher = more dangerous.
   *
   * @param totalCells - Total grid cells (e.g. 25 for 5x5)
   * @param mineCount  - Number of mines per round
   * @param baseSeed   - Base seed string (used to derive simulated server seeds)
   * @returns Array of length totalCells with mine probability per cell
   */
  generateDensityMap(totalCells: number, mineCount: number, baseSeed: string): number[] {
    const hitCount = new Array(totalCells).fill(0);

    // Use the REAL fairness engine algorithm for each simulation.
    // Each iteration simulates a different server seed but same client seed / nonce structure.
    for (let i = 0; i < this.iterations; i++) {
      // Create a unique simulated "server seed" for this iteration
      const simServerSeed = `sim-${baseSeed}-${i}`;
      const simClientSeed = 'monte-carlo';
      const simNonce = i;

      // Use the EXACT same Fisher-Yates algorithm the real system uses
      const mines = generateMinePositions(simServerSeed, simClientSeed, simNonce, mineCount, totalCells);
      mines.forEach((pos) => { hitCount[pos]++; });
    }

    // Convert counts to probabilities
    return hitCount.map(count => count / this.iterations);
  }

  /**
   * Generate a RELATIVE deviation map that shows how far each tile's
   * observed probability deviates from the expected base rate.
   * 
   * Returns values where:
   *   0.0 = tile hit rate equals base rate (average)
   *   positive = tile has MORE mines than expected (more dangerous)
   *   negative = tile has FEWER mines than expected (safer)
   * 
   * This is much more meaningful for display than raw probabilities
   * which are all clustered around the base rate.
   */
  generateDeviationMap(totalCells: number, mineCount: number, baseSeed: string): {
    rawMap: number[];
    deviationMap: number[];
    baseRate: number;
    maxDeviation: number;
    minDeviation: number;
  } {
    const rawMap = this.generateDensityMap(totalCells, mineCount, baseSeed);
    const baseRate = mineCount / totalCells;

    const deviationMap = rawMap.map(prob => prob - baseRate);
    const maxDeviation = Math.max(...deviationMap);
    const minDeviation = Math.min(...deviationMap);

    return { rawMap, deviationMap, baseRate, maxDeviation, minDeviation };
  }

  /**
   * Identify cells with mine probability below the threshold ("dead zones" = safest tiles).
   * With correct Fisher-Yates, for 3 mines in 25 cells, expected probability per cell
   * is 3/25 = 0.12 (12%). So threshold of 0.15 catches cells near or below average.
   */
  identifyDeadZones(heatMap: number[], threshold: number = 0.15): number[] {
    return heatMap
      .map((prob, index) => ({ index, prob }))
      .filter((t) => t.prob < threshold)
      .sort((a, b) => a.prob - b.prob)
      .map((t) => t.index);
  }

  /**
   * Get the top N safest tiles sorted by lowest mine probability.
   */
  getSafestTiles(heatMap: number[], count: number = 5): { index: number; safePercent: number }[] {
    return heatMap
      .map((prob, index) => ({ index, safePercent: (1 - prob) * 100 }))
      .sort((a, b) => b.safePercent - a.safePercent)
      .slice(0, count);
  }

  /**
   * Compute the standard deviation of the heatmap to measure
   * how much the distribution deviates from uniform.
   */
  computeDistributionStats(heatMap: number[]): {
    mean: number;
    stdDev: number;
    coeffOfVariation: number;
    isUniform: boolean;
  } {
    const mean = heatMap.reduce((a, b) => a + b, 0) / heatMap.length;
    const variance = heatMap.reduce((sum, v) => sum + (v - mean) ** 2, 0) / heatMap.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = mean > 0 ? stdDev / mean : 0;
    
    // Distribution is "uniform" if coefficient of variation is small
    const isUniform = coeffOfVariation < 0.05;

    return { mean, stdDev, coeffOfVariation, isUniform };
  }
}