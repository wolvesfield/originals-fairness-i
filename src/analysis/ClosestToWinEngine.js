"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClosestToWinEngine = void 0;
var ClientSeedOptimizer_1 = require("./ClientSeedOptimizer");
var ClusterVarianceAnalyzer_1 = require("./ClusterVarianceAnalyzer");
var AllocationEngine_1 = require("./AllocationEngine");
var VolatilityHedge_1 = require("./VolatilityHedge");
/**
 * ClosestToWinEngine
 *
 * Synthesizes multiple statistical and probabilistic tools to generate the
 * mathematically safest playing strategy for Stake Mines when the unhashed
 * server seed is UNKNOWN. This is not absolute prediction, but EV optimization.
 */
var ClosestToWinEngine = /** @class */ (function () {
    function ClosestToWinEngine() {
        this.clientSeedOptimizer = new ClientSeedOptimizer_1.ClientSeedOptimizer();
        this.cva = new ClusterVarianceAnalyzer_1.ClusterVarianceAnalyzer();
        // Quarter-Kelly, max 5% of bankroll for standard risk tolerance
        this.allocation = new AllocationEngine_1.AllocationEngine(0.25, 0.05);
        this.hedge = new VolatilityHedge_1.VolatilityHedge();
    }
    /**
     * Generates a comprehensive, actionable "Closest to Win" strategy.
     *
     * @param serverSeedHash The current locked server seed hash
     * @param currentNonce The nonce for the upcoming bet
     * @param mineCount The configured amount of mines
     * @param totalCells Grid size (e.g. 25 for 5x5)
     * @param bankroll Current available balance
     * @param targetMultiplier The odds the user is trying to reach (used for Kelly sizing)
     * @returns Recommendations on seed, tile selection, and bet sizing.
     */
    ClosestToWinEngine.prototype.analyzeOptimalStrategy = function (serverSeedHash, currentNonce, mineCount, totalCells, bankroll, targetMultiplier, platform) {
        if (bankroll === void 0) { bankroll = 100; }
        if (targetMultiplier === void 0) { targetMultiplier = 2.0; }
        if (platform === void 0) { platform = 'stake'; }
        // 1. Determine safe tile pick count based on target multiplier target.
        // For simplicity, we recommend picking exactly enough tiles to maintain a high base win rate.
        // In Mines, base rate per tile is (Total - Mines) / Total.
        var safeTilesPickCount = Math.max(1, Math.floor(totalCells / (mineCount * 1.5)));
        // 2. Generate Monte Carlo Density map purely based on hash structure
        // We use a dummy client seed first just to get the structural baseline of the grid
        var structuralMap = this.cva.generateDensityMap(totalCells, mineCount, "".concat(serverSeedHash, "-baseline"));
        // 3. Mathematical Clustering
        // Find geographically distinct clusters that statistically show slightly lower mine
        // density in our monte carlo spread. Picking 1 tile from 3 distinct clusters is mathematically
        // safer than picking 3 adjacent tiles if the PRNG has tiny spatial biases.
        var safeClusters = this.cva.generateKMeansSafetyClusters(structuralMap, Math.sqrt(totalCells), 3);
        // Filter out any clusters that are completely empty
        safeClusters = safeClusters.filter(function (cluster) { return cluster.length > 0; });
        // Define our exact "target" abstract tiles as the center/safest of each cluster
        var targetVariances = [];
        safeClusters.forEach(function (cluster) {
            // grab the safest tile in this cluster
            var safestInCluster = cluster[0];
            var lowestProb = 1.0;
            cluster.forEach(function (idx) {
                if (structuralMap[idx] < lowestProb) {
                    lowestProb = structuralMap[idx];
                    safestInCluster = idx;
                }
            });
            targetVariances.push(safestInCluster);
        });
        // 4. Client Seed Optimization
        // Brute force a client seed that performs exceptionally well across a spread of simulated server seeds
        // specifically for our dynamically chosen target tiles.
        var seedOptimization = this.clientSeedOptimizer.optimizeForTargetMines(null, // No unhashed seed available
        serverSeedHash, currentNonce, targetVariances.slice(0, safeTilesPickCount), mineCount, totalCells, 1500, // 1.5 second search
        platform);
        // 5. EV Sizing & Volatility Hedging
        // Base confidence is the combinatorial odds of hitting exactly safeTilesPickCount
        var baseConfidence = 1.0;
        for (var j = 0; j < safeTilesPickCount; j++) {
            baseConfidence *= (totalCells - mineCount - j) / (totalCells - j);
        }
        // Adjust confidence slightly based on our brute-forced seed spread success
        var adjustedConfidence = baseConfidence + ((seedOptimization.safeProbability - baseConfidence) * 0.1);
        var hedgeRisk = this.hedge.calculateHedgeFactor(1.0); // Normal operation
        var rawKelly = this.allocation.calculateOptimalAllocation(adjustedConfidence, targetMultiplier, bankroll);
        var finalAllocation = rawKelly * hedgeRisk;
        var percentAlloc = bankroll > 0 ? (finalAllocation / bankroll) * 100 : 0;
        return {
            optimalClientSeed: seedOptimization.bestSeed,
            safeTilesPickCount: safeTilesPickCount,
            recommendedClusters: safeClusters,
            betSizeAllocationPercent: percentAlloc,
            confidenceScore: adjustedConfidence,
            description: "Statistically optimal play: Rotate client seed to [".concat(seedOptimization.bestSeed, "], limit picks to ").concat(safeTilesPickCount, " tiles across distinct geographical safety clusters. Bet max ").concat(percentAlloc.toFixed(2), "% of bankroll based on Fractional Kelly.")
        };
    };
    return ClosestToWinEngine;
}());
exports.ClosestToWinEngine = ClosestToWinEngine;
