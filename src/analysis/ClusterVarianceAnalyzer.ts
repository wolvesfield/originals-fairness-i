import { generateMinePositions, generateKenoNumbers, calculateCrashPoint } from '../utils/fairnessEngine';

/**
 * Monte Carlo Density Mapping using the REAL fairness engine algorithm.
 * Uses the same Fisher-Yates shuffle + HMAC-SHA256 float generation
 * as the actual provably fair system, ensuring accurate probability maps.
 *
 * Each simulation uses a unique simulated server seed so the distribution
 * is representative of actual mine placement behaviour.
 */
export class ClusterVarianceAnalyzer {
  private iterations = 50000;

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
   * Generate a probability hit map for Keno (how likely each of the maxNum numbers is to be drawn).
   */
  generateKenoDensityMap(drawCount: number, maxNum: number, baseSeed: string): number[] {
    const hitCount = new Array(maxNum).fill(0);

    for (let i = 0; i < this.iterations; i++) {
      const simServerSeed = `sim-keno-${baseSeed}-${i}`;
      const simClientSeed = 'monte-carlo-keno';
      const simNonce = i;

      const numbers = generateKenoNumbers(simServerSeed, simClientSeed, simNonce, drawCount, maxNum);
      numbers.forEach((num) => {
        hitCount[num - 1]++; // 1-indexed to 0-indexed
      });
    }

    return hitCount.map(count => count / this.iterations);
  }

  /**
   * Generate an expected average Crash multiplier via Monte Carlo.
   */
  generateCrashMonteCarlo(baseSeed: string): { average: number; median: number; safe2x: number } {
    const multipliers: number[] = [];
    let safe2xCount = 0;

    for (let i = 0; i < this.iterations; i++) {
      const simServerSeed = `sim-crash-${baseSeed}-${i}`;
      const simClientSeed = 'monte-carlo-crash';
      const simNonce = i;

      const crash = calculateCrashPoint(simServerSeed, simClientSeed, simNonce);
      multipliers.push(crash);
      if (crash >= 2.0) safe2xCount++;
    }

    multipliers.sort((a, b) => a - b);
    const average = multipliers.reduce((a, b) => a + b, 0) / this.iterations;
    const median = multipliers[Math.floor(this.iterations / 2)];
    const safe2x = safe2xCount / this.iterations;

    return { average, median, safe2x };
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

  /**
   * K-Means Statistical Clustering 
   * Groups high-safety vs low-safety grid tiles based on their geographical 
   * distance in the grid combined with their statistical probability of containing a mine.
   * Helps avoid picking adjacent tiles from a single "cluster" that might contain a stray mine.
   */
  public generateKMeansSafetyClusters(heatMap: number[], gridSize: number, clusters: number = 3): number[][] {
    const k = Math.max(1, Math.min(clusters, heatMap.length));

    // Convert flat index to { x, y, prob }
    const points = heatMap.map((prob, i) => ({
      index: i,
      x: i % gridSize,
      y: Math.floor(i / gridSize),
      prob
    }));

    // Initialize centroids randomly from points
    let centroids = Array.from({ length: k }, () => points[Math.floor(Math.random() * points.length)]);
    let assignments: number[] = new Array(points.length).fill(-1);
    let changed = true;
    let maxIterations = 20;

    while (changed && maxIterations > 0) {
      changed = false;
      maxIterations--;

      // Assign points to nearest centroid
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let bestDist = Infinity;
        let bestCluster = 0;

        for (let j = 0; j < k; j++) {
          const c = centroids[j];
          // Distance equals Euclidian geographical distance + probability weight
          const dist = Math.sqrt(Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2)) + (Math.abs(p.prob - c.prob) * gridSize);
          if (dist < bestDist) {
            bestDist = dist;
            bestCluster = j;
          }
        }

        if (assignments[i] !== bestCluster) {
          assignments[i] = bestCluster;
          changed = true;
        }
      }

      // Recompute centroids
      if (changed) {
        const newCentroids = Array.from({ length: k }, () => ({ x: 0, y: 0, prob: 0, count: 0 }));
        for (let i = 0; i < points.length; i++) {
          const cluster = assignments[i];
          const p = points[i];
          newCentroids[cluster].x += p.x;
          newCentroids[cluster].y += p.y;
          newCentroids[cluster].prob += p.prob;
          newCentroids[cluster].count++;
        }

        centroids = newCentroids.map((nc, idx) => {
          if (nc.count === 0) return centroids[idx]; // Keep old centroid if cluster is empty
          return {
            x: nc.x / nc.count,
            y: nc.y / nc.count,
            prob: nc.prob / nc.count,
            index: -1 // Centroid is abstract
          };
        });
      }
    }

    // Sort clusters by average probability (lowest probability = safest cluster first)
    const clusterArrays = Array.from({ length: k }, () => [] as typeof points);
    for (let i = 0; i < points.length; i++) {
      clusterArrays[assignments[i]].push(points[i]);
    }

    clusterArrays.sort((a, b) => {
      const probA = a.reduce((sum, p) => sum + p.prob, 0) / (a.length || 1);
      const probB = b.reduce((sum, p) => sum + p.prob, 0) / (b.length || 1);
      return probA - probB;
    });

    // Return arrays of indices, grouped by safe clusters
    return clusterArrays.map(cluster => cluster.map(p => p.index));
  }
}