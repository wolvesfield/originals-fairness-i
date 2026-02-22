import CryptoJS from 'crypto-js';

/**
 * 50,000 Iteration Monte Carlo Density Mapping
 * Identifies statistical "dead zones" with <15% collision probability
 */
export class ClusterVarianceAnalyzer {
  private iterations = 50000;

  generateDensityMap(gridSize: number, mineCount: number, baseSeed: string): number[] {
    const heatMap = new Array(gridSize).fill(0);

    for (let i = 0; i < this.iterations; i++) {
      const simHash = CryptoJS.HmacSHA256(`sim:${i}:0`, baseSeed).toString(CryptoJS.enc.Hex);
      const mines = this.mapHashToMines(simHash, mineCount, gridSize);
      mines.forEach((pos) => { heatMap[pos] += 1 / this.iterations; });
    }

    return heatMap;
  }

  identifyDeadZones(heatMap: number[], threshold: number = 0.15): number[] {
    return heatMap
      .map((prob, index) => ({ index, prob }))
      .filter((t) => t.prob < threshold)
      .sort((a, b) => a.prob - b.prob)
      .map((t) => t.index);
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
        hash = CryptoJS.SHA256(hash).toString(CryptoJS.enc.Hex);
        idx = 0;
      }
    }
    return mines;
  }
}

// CLI entry point for standalone testing
if (typeof process !== 'undefined' && process.argv[1]?.includes('ClusterVarianceAnalyzer')) {
  console.log('═══ CLUSTER VARIANCE ANALYZER — MONTE CARLO DEMO ═══\n');
  const cva = new ClusterVarianceAnalyzer();
  const seed = process.argv[2] || 'demo-seed:42';
  const gridSize = 25;
  const mineCount = 3;

  console.log(`Seed basis: "${seed}"`);
  console.log(`Grid: ${gridSize} cells, ${mineCount} mines`);
  console.log(`Running 50,000 Monte Carlo iterations...\n`);

  const start = Date.now();
  const heatMap = cva.generateDensityMap(gridSize, mineCount, seed);
  const elapsed = Date.now() - start;

  console.log('Heat Map (mine probability per cell):');
  for (let row = 0; row < 5; row++) {
    const cells = heatMap.slice(row * 5, row * 5 + 5).map(p => p.toFixed(3).padStart(6));
    console.log(`  Row ${row}: [${cells.join(', ')}]`);
  }

  const deadZones = cva.identifyDeadZones(heatMap);
  console.log(`\nDead Zones (<15% probability): [${deadZones.join(', ')}]`);
  console.log(`Completed in ${elapsed}ms`);
}
