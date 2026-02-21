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
