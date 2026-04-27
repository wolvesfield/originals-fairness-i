"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterVarianceAnalyzer = void 0;
var fairnessEngine_1 = require("../utils/fairnessEngine");
/**
 * Monte Carlo Density Mapping using the REAL fairness engine algorithm.
 * Uses the same Fisher-Yates shuffle + HMAC-SHA256 float generation
 * as the actual provably fair system, ensuring accurate probability maps.
 *
 * Each simulation uses a unique simulated server seed so the distribution
 * is representative of actual mine placement behaviour.
 */
var ClusterVarianceAnalyzer = /** @class */ (function () {
    function ClusterVarianceAnalyzer() {
        this.iterations = 50000;
    }
    /**
     * Generate a probability heat map showing how likely each cell is to
     * contain a mine. Values are in [0, 1] where higher = more dangerous.
     *
     * @param totalCells - Total grid cells (e.g. 25 for 5x5)
     * @param mineCount  - Number of mines per round
     * @param baseSeed   - Base seed string (used to derive simulated server seeds)
     * @returns Array of length totalCells with mine probability per cell
     */
    ClusterVarianceAnalyzer.prototype.generateDensityMap = function (totalCells, mineCount, baseSeed) {
        var _this = this;
        var hitCount = new Array(totalCells).fill(0);
        // Use the REAL fairness engine algorithm for each simulation.
        // Each iteration simulates a different server seed but same client seed / nonce structure.
        for (var i = 0; i < this.iterations; i++) {
            // Create a unique simulated "server seed" for this iteration
            var simServerSeed = "sim-".concat(baseSeed, "-").concat(i);
            var simClientSeed = 'monte-carlo';
            var simNonce = i;
            // Use the EXACT same Fisher-Yates algorithm the real system uses
            var mines = (0, fairnessEngine_1.generateMinePositions)(simServerSeed, simClientSeed, simNonce, mineCount, totalCells);
            mines.forEach(function (pos) { hitCount[pos]++; });
        }
        // Convert counts to probabilities
        return hitCount.map(function (count) { return count / _this.iterations; });
    };
    /**
     * Generate a probability hit map for Keno (how likely each of the maxNum numbers is to be drawn).
     */
    ClusterVarianceAnalyzer.prototype.generateKenoDensityMap = function (drawCount, maxNum, baseSeed) {
        var _this = this;
        var hitCount = new Array(maxNum).fill(0);
        for (var i = 0; i < this.iterations; i++) {
            var simServerSeed = "sim-keno-".concat(baseSeed, "-").concat(i);
            var simClientSeed = 'monte-carlo-keno';
            var simNonce = i;
            var numbers = (0, fairnessEngine_1.generateKenoNumbers)(simServerSeed, simClientSeed, simNonce, drawCount, maxNum);
            numbers.forEach(function (num) {
                hitCount[num - 1]++; // 1-indexed to 0-indexed
            });
        }
        return hitCount.map(function (count) { return count / _this.iterations; });
    };
    /**
     * Generate an expected average Crash multiplier via Monte Carlo.
     */
    ClusterVarianceAnalyzer.prototype.generateCrashMonteCarlo = function (baseSeed) {
        var multipliers = [];
        var safe2xCount = 0;
        for (var i = 0; i < this.iterations; i++) {
            var simServerSeed = "sim-crash-".concat(baseSeed, "-").concat(i);
            var simClientSeed = 'monte-carlo-crash';
            var simNonce = i;
            var crash = (0, fairnessEngine_1.calculateCrashPoint)(simServerSeed, simClientSeed, simNonce);
            multipliers.push(crash);
            if (crash >= 2.0)
                safe2xCount++;
        }
        multipliers.sort(function (a, b) { return a - b; });
        var average = multipliers.reduce(function (a, b) { return a + b; }, 0) / this.iterations;
        var median = multipliers[Math.floor(this.iterations / 2)];
        var safe2x = safe2xCount / this.iterations;
        return { average: average, median: median, safe2x: safe2x };
    };
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
    ClusterVarianceAnalyzer.prototype.generateDeviationMap = function (totalCells, mineCount, baseSeed) {
        var rawMap = this.generateDensityMap(totalCells, mineCount, baseSeed);
        var baseRate = mineCount / totalCells;
        var deviationMap = rawMap.map(function (prob) { return prob - baseRate; });
        var maxDeviation = Math.max.apply(Math, deviationMap);
        var minDeviation = Math.min.apply(Math, deviationMap);
        return { rawMap: rawMap, deviationMap: deviationMap, baseRate: baseRate, maxDeviation: maxDeviation, minDeviation: minDeviation };
    };
    /**
     * Identify cells with mine probability below the threshold ("dead zones" = safest tiles).
     * With correct Fisher-Yates, for 3 mines in 25 cells, expected probability per cell
     * is 3/25 = 0.12 (12%). So threshold of 0.15 catches cells near or below average.
     */
    ClusterVarianceAnalyzer.prototype.identifyDeadZones = function (heatMap, threshold) {
        if (threshold === void 0) { threshold = 0.15; }
        return heatMap
            .map(function (prob, index) { return ({ index: index, prob: prob }); })
            .filter(function (t) { return t.prob < threshold; })
            .sort(function (a, b) { return a.prob - b.prob; })
            .map(function (t) { return t.index; });
    };
    /**
     * Get the top N safest tiles sorted by lowest mine probability.
     */
    ClusterVarianceAnalyzer.prototype.getSafestTiles = function (heatMap, count) {
        if (count === void 0) { count = 5; }
        return heatMap
            .map(function (prob, index) { return ({ index: index, safePercent: (1 - prob) * 100 }); })
            .sort(function (a, b) { return b.safePercent - a.safePercent; })
            .slice(0, count);
    };
    /**
     * Compute the standard deviation of the heatmap to measure
     * how much the distribution deviates from uniform.
     */
    ClusterVarianceAnalyzer.prototype.computeDistributionStats = function (heatMap) {
        var mean = heatMap.reduce(function (a, b) { return a + b; }, 0) / heatMap.length;
        var variance = heatMap.reduce(function (sum, v) { return sum + Math.pow((v - mean), 2); }, 0) / heatMap.length;
        var stdDev = Math.sqrt(variance);
        var coeffOfVariation = mean > 0 ? stdDev / mean : 0;
        // Distribution is "uniform" if coefficient of variation is small
        var isUniform = coeffOfVariation < 0.05;
        return { mean: mean, stdDev: stdDev, coeffOfVariation: coeffOfVariation, isUniform: isUniform };
    };
    /**
     * K-Means Statistical Clustering
     * Groups high-safety vs low-safety grid tiles based on their geographical
     * distance in the grid combined with their statistical probability of containing a mine.
     * Helps avoid picking adjacent tiles from a single "cluster" that might contain a stray mine.
     */
    ClusterVarianceAnalyzer.prototype.generateKMeansSafetyClusters = function (heatMap, gridSize, clusters) {
        if (clusters === void 0) { clusters = 3; }
        var k = Math.max(1, Math.min(clusters, heatMap.length));
        // Convert flat index to { x, y, prob }
        var points = heatMap.map(function (prob, i) { return ({
            index: i,
            x: i % gridSize,
            y: Math.floor(i / gridSize),
            prob: prob
        }); });
        // Initialize centroids randomly from points
        var centroids = Array.from({ length: k }, function () { return points[Math.floor(Math.random() * points.length)]; });
        var assignments = new Array(points.length).fill(-1);
        var changed = true;
        var maxIterations = 20;
        while (changed && maxIterations > 0) {
            changed = false;
            maxIterations--;
            // Assign points to nearest centroid
            for (var i = 0; i < points.length; i++) {
                var p = points[i];
                var bestDist = Infinity;
                var bestCluster = 0;
                for (var j = 0; j < k; j++) {
                    var c = centroids[j];
                    // Distance equals Euclidian geographical distance + probability weight
                    var dist = Math.sqrt(Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2)) + (Math.abs(p.prob - c.prob) * gridSize);
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
                var newCentroids = Array.from({ length: k }, function () { return ({ x: 0, y: 0, prob: 0, count: 0 }); });
                for (var i = 0; i < points.length; i++) {
                    var cluster = assignments[i];
                    var p = points[i];
                    newCentroids[cluster].x += p.x;
                    newCentroids[cluster].y += p.y;
                    newCentroids[cluster].prob += p.prob;
                    newCentroids[cluster].count++;
                }
                centroids = newCentroids.map(function (nc, idx) {
                    if (nc.count === 0)
                        return centroids[idx]; // Keep old centroid if cluster is empty
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
        var clusterArrays = Array.from({ length: k }, function () { return []; });
        for (var i = 0; i < points.length; i++) {
            clusterArrays[assignments[i]].push(points[i]);
        }
        clusterArrays.sort(function (a, b) {
            var probA = a.reduce(function (sum, p) { return sum + p.prob; }, 0) / (a.length || 1);
            var probB = b.reduce(function (sum, p) { return sum + p.prob; }, 0) / (b.length || 1);
            return probA - probB;
        });
        // Return arrays of indices, grouped by safe clusters
        return clusterArrays.map(function (cluster) { return cluster.map(function (p) { return p.index; }); });
    };
    return ClusterVarianceAnalyzer;
}());
exports.ClusterVarianceAnalyzer = ClusterVarianceAnalyzer;
