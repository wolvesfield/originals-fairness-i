"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllocationEngine = void 0;
/**
 * Dynamic Risk-Adjusted Allocation using Kelly Criterion
 * Uses Quarter-Kelly fractional sizing for safety
 */
var AllocationEngine = /** @class */ (function () {
    function AllocationEngine(fraction, maxPercent) {
        if (fraction === void 0) { fraction = 0.25; }
        if (maxPercent === void 0) { maxPercent = 0.05; }
        this.fractionMultiplier = fraction;
        this.maxBankrollPercent = maxPercent;
    }
    AllocationEngine.prototype.calculateOptimalAllocation = function (confidence, odds, bankroll) {
        var p = confidence;
        var b = odds - 1;
        var q = 1 - p;
        var fullKelly = (b * p - q) / b;
        if (fullKelly <= 0)
            return 0;
        var fractionalKelly = fullKelly * this.fractionMultiplier;
        return Math.min(fractionalKelly * bankroll, bankroll * this.maxBankrollPercent);
    };
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
    AllocationEngine.prototype.calculateMartingaleHedging = function (baseBet, consecutiveLosses, payoutMultiplier, bankroll) {
        if (consecutiveLosses === 0)
            return baseBet;
        if (payoutMultiplier <= 1.0)
            return baseBet; // mathematically impossible to recover
        // Formula: To recover L amount lost and still make base bet profit:
        // NextBet * (Payout - 1) = TotalLost + BaseProfit
        // This simplifies under a constant base bet scale to:
        var totalLost = 0;
        var currentBet = baseBet;
        // Calculate total money lost so far in this exact streak
        for (var i = 0; i < consecutiveLosses; i++) {
            totalLost += currentBet;
            currentBet = (totalLost + baseBet) / (payoutMultiplier - 1);
        }
        var requiredBet = (totalLost + baseBet) / (payoutMultiplier - 1);
        // Hard bankroll safety limit for Martingale (prevents 0-balances on black swan streaks)
        var maxSafeMartingaleBet = bankroll * (this.maxBankrollPercent * 4); // 4x normal max allowed during extreme hedging
        return Math.min(requiredBet, maxSafeMartingaleBet);
    };
    return AllocationEngine;
}());
exports.AllocationEngine = AllocationEngine;
