/**
 * Gaussian Variance Attenuation Circuit Breaker
 * H_f = e^(-((V_obs - V_exp)^2) / (2 * gamma^2))
 */
export class VolatilityHedge {
  private rollingWindow: number[] = [];
  private readonly maxWindowSize = 50;
  private readonly baselineSigma = 1.0;

  calculateHedgeFactor(latestOutcome: number): number {
    this.rollingWindow.push(latestOutcome);
    if (this.rollingWindow.length > this.maxWindowSize) this.rollingWindow.shift();
    if (this.rollingWindow.length < this.maxWindowSize) return 1.0;

    const currentSigma = this.stddev(this.rollingWindow);
    if (currentSigma <= this.baselineSigma) return 1.0;

    const delta = currentSigma - this.baselineSigma;
    return Math.max(Math.exp(-(delta * delta) / 0.5), 0.05);
  }

  private stddev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map((v) => (v - avg) ** 2);
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
  }
}
