/**
 * Dynamic Risk-Adjusted Allocation using Kelly Criterion
 * Uses Quarter-Kelly fractional sizing for safety
 */
export class AllocationEngine {
  private fractionMultiplier: number;
  private maxBankrollPercent: number;

  constructor(fraction: number = 0.25, maxPercent: number = 0.05) {
    this.fractionMultiplier = fraction;
    this.maxBankrollPercent = maxPercent;
  }

  calculateOptimalAllocation(confidence: number, odds: number, bankroll: number): number {
    const p = confidence;
    const b = odds - 1;
    const q = 1 - p;

    const fullKelly = (b * p - q) / b;
    if (fullKelly <= 0) return 0;

    const fractionalKelly = fullKelly * this.fractionMultiplier;
    return Math.min(fractionalKelly * bankroll, bankroll * this.maxBankrollPercent);
  }
}
