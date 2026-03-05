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

  /**
   * Martingale Hedging Circuit
   * Calculates the exact bet size needed to recoup previous consecutive losses 
   * while continuing to target the original base profit, assuming the payout odds.
   * 
   * @param baseBet The original standard bet size when not on a losing streak
   * @param consecutiveLosses Number of losses in a row
   * @param payoutMultiplier The odds of the current bet (e.g. 2.0x)
   * @param bankroll Current total bankroll (for safety limits)
   */
  calculateMartingaleHedging(
    baseBet: number,
    consecutiveLosses: number,
    payoutMultiplier: number,
    bankroll: number
  ): number {
    if (consecutiveLosses === 0) return baseBet;
    if (payoutMultiplier <= 1.0) return baseBet; // mathematically impossible to recover

    // Formula: To recover L amount lost and still make base bet profit:
    // NextBet * (Payout - 1) = TotalLost + BaseProfit
    // This simplifies under a constant base bet scale to:
    let totalLost = 0;
    let currentBet = baseBet;

    // Calculate total money lost so far in this exact streak
    for (let i = 0; i < consecutiveLosses; i++) {
      totalLost += currentBet;
      currentBet = (totalLost + baseBet) / (payoutMultiplier - 1);
    }

    const requiredBet = (totalLost + baseBet) / (payoutMultiplier - 1);

    // Hard bankroll safety limit for Martingale (prevents 0-balances on black swan streaks)
    const maxSafeMartingaleBet = bankroll * (this.maxBankrollPercent * 4); // 4x normal max allowed during extreme hedging
    return Math.min(requiredBet, maxSafeMartingaleBet);
  }
}
