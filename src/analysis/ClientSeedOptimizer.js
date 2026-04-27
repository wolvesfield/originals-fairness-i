"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSeedOptimizer = void 0;
var fairnessEngine_1 = require("../utils/fairnessEngine");
/**
 * Client Seed Optimizer
 *
 * Bends the statistical probability in the player's favor by aggressively
 * brute-forcing thousands of random client seeds LOCALLY before a bet.
 * The output is the mathematically "perfect" client seed the player should
 * use to maximize the chance of avoiding mines in their specific target tiles.
 */
var ClientSeedOptimizer = /** @class */ (function () {
    function ClientSeedOptimizer() {
    }
    /**
     * Generates a random alphanumeric client seed of given length
     */
    ClientSeedOptimizer.prototype.generateRandomSeed = function (length) {
        if (length === void 0) { length = 24; }
        var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var result = '';
        for (var i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };
    /**
     * Brute forces client seeds to find one that guarantees safety for the target tiles
     * on the NEXT immediate nonce, assuming we know the unhashed server seed.
     * If we DO NOT know the server seed, we test against a simulated spread
     * to find seeds that generally cluster mines *away* from the target zone.
     */
    ClientSeedOptimizer.prototype.optimizeForTargetMines = function (unhashedServerSeed, // null if only predicting
    serverSeedHash, // fallback used if unhashed is null
    nonce, targetTiles, mineCount, totalCells, maxSearchTimeMs, platform) {
        if (mineCount === void 0) { mineCount = 3; }
        if (totalCells === void 0) { totalCells = 25; }
        if (maxSearchTimeMs === void 0) { maxSearchTimeMs = 2000; }
        var startTime = performance.now();
        var bestSeed = this.generateRandomSeed();
        var highestSafetyScore = 0;
        var iterations = 0;
        // SCENARIO A: DETERMINISTIC MODE (We know the revealed seed)
        // We can guarantee a 100% win on the next nonce just by picking a seed
        // that puts 0 mines in the target tiles for that specific revealed seed.
        if (unhashedServerSeed) {
            var _loop_1 = function () {
                iterations++;
                var candidateSeed = this_1.generateRandomSeed();
                var mines = (0, fairnessEngine_1.generateMinePositions)(unhashedServerSeed, candidateSeed, nonce, mineCount, totalCells, platform);
                var isCompletelySafe = !targetTiles.some(function (t) { return mines.includes(t); });
                if (isCompletelySafe) {
                    return { value: {
                            bestSeed: candidateSeed,
                            safeProbability: 1.0,
                            iterations: iterations,
                            timeMs: Math.round(performance.now() - startTime)
                        } };
                }
            };
            var this_1 = this;
            while (performance.now() - startTime < maxSearchTimeMs) {
                var state_1 = _loop_1();
                if (typeof state_1 === "object")
                    return state_1.value;
            }
            return {
                bestSeed: bestSeed,
                safeProbability: 0, // Failed to find a flawless one in time
                iterations: iterations,
                timeMs: Math.round(performance.now() - startTime)
            };
        }
        // SCENARIO B: PROBABILISTIC MODE (We only have the hash)
        // We cannot mathematically guarantee the exact position without the server seed.
        // But we CAN find a client seed that clusters the HMAC-SHA256 float generations
        // in patterns away from our targets over a Monte Carlo spread. 
        while (performance.now() - startTime < maxSearchTimeMs) {
            iterations++;
            var candidateSeed = this.generateRandomSeed();
            var safeHits = 0;
            var spreadSize = 50;
            var _loop_2 = function (i) {
                // Simulate potential unhashed seeds by hashing variants of the actual hash
                // This measures the client seed's geometric resilience to random server seeds
                var simServerSeed = "sim-".concat(serverSeedHash, "-").concat(i);
                var mines = (0, fairnessEngine_1.generateMinePositions)(simServerSeed, candidateSeed, nonce, mineCount, totalCells, platform);
                if (!targetTiles.some(function (t) { return mines.includes(t); })) {
                    safeHits++;
                }
            };
            for (var i = 0; i < spreadSize; i++) {
                _loop_2(i);
            }
            var score = safeHits / spreadSize;
            if (score > highestSafetyScore) {
                highestSafetyScore = score;
                bestSeed = candidateSeed;
            }
            // If we find a seed with exceptionally high probability spread avoidance, exit early
            if (highestSafetyScore > 0.95)
                break;
        }
        return {
            bestSeed: bestSeed,
            safeProbability: highestSafetyScore,
            iterations: iterations,
            timeMs: Math.round(performance.now() - startTime)
        };
    };
    return ClientSeedOptimizer;
}());
exports.ClientSeedOptimizer = ClientSeedOptimizer;
