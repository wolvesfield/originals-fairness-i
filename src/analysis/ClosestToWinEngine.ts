import { ClientSeedOptimizer } from './ClientSeedOptimizer';
import { ClusterVarianceAnalyzer } from './ClusterVarianceAnalyzer';
import { AllocationEngine } from './AllocationEngine';
import { VolatilityHedge } from './VolatilityHedge';
import { MarkovChainAnalyzer } from './MarkovChainAnalyzer';

export interface ClosestToWinRecommendation {
    optimalClientSeed: string;
    safeTilesPickCount: number;
    recommendedClusters: number[][]; // Arrays of tile indices representing distinct safe geographical clusters
    betSizeAllocationPercent: number;
    confidenceScore: number;
    description: string;
}

/**
 * ClosestToWinEngine
 * 
 * Synthesizes multiple statistical and probabilistic tools to generate the
 * mathematically safest playing strategy for Stake Mines when the unhashed
 * server seed is UNKNOWN. This is not absolute prediction, but EV optimization.
 */
export class ClosestToWinEngine {
    private clientSeedOptimizer: ClientSeedOptimizer;
    private cva: ClusterVarianceAnalyzer;
    private allocation: AllocationEngine;
    private hedge: VolatilityHedge;

    constructor() {
        this.clientSeedOptimizer = new ClientSeedOptimizer();
        this.cva = new ClusterVarianceAnalyzer();
        // Quarter-Kelly, max 5% of bankroll for standard risk tolerance
        this.allocation = new AllocationEngine(0.25, 0.05);
        this.hedge = new VolatilityHedge();
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
    public analyzeOptimalStrategy(
        serverSeedHash: string,
        currentNonce: number,
        mineCount: number,
        totalCells: number,
        bankroll: number = 100,
        targetMultiplier: number = 2.0,
        platform: 'stake' | 'roobet' = 'stake',
        historySequence: number[][] = []
    ): ClosestToWinRecommendation {
        // 1. Determine safe tile pick count based on target multiplier target.
        // For simplicity, we recommend picking exactly enough tiles to maintain a high base win rate.
        // In Mines, base rate per tile is (Total - Mines) / Total.
        const safeTilesPickCount = Math.max(1, Math.floor(totalCells / (mineCount * 1.5))); 

        // 2. Generate Monte Carlo Density map purely based on hash structure
        // We use a dummy client seed first just to get the structural baseline of the grid
        const structuralMap = this.cva.generateDensityMap(totalCells, mineCount, `${serverSeedHash}-baseline`);

        // 2b. Apply Markov Chain Temporal Bias if history exists
        if (historySequence.length > 1) {
            const markov = new MarkovChainAnalyzer(totalCells);
            markov.ingestHistory(historySequence);
            const lastMines = historySequence[historySequence.length - 1];
            const markovPredictions = markov.predictNextState(lastMines);

            // Blend Markov temporal prediction into the structural map
            // Since structuralMap is a probability of a mine being there, we ADD the markov prediction
            // to heavily penalize tiles the Markov chain thinks a mine will shift to.
            for (let i = 0; i < totalCells; i++) {
                structuralMap[i] += markovPredictions[i] * 2.0; // 2x weight for temporal patterns
            }
        }

        // 3. Mathematical Clustering
        // Find geographically distinct clusters that statistically show slightly lower mine
        // density in our monte carlo spread. Picking 1 tile from 3 distinct clusters is mathematically
        // safer than picking 3 adjacent tiles if the PRNG has tiny spatial biases.
        let safeClusters = this.cva.generateKMeansSafetyClusters(structuralMap, Math.sqrt(totalCells), 3);
        
        // Filter out any clusters that are completely empty
        safeClusters = safeClusters.filter(cluster => cluster.length > 0);

        // Define our exact "target" abstract tiles as the center/safest of each cluster
        const targetVariances: number[] = [];
        safeClusters.forEach(cluster => {
            // grab the safest tile in this cluster
            let safestInCluster = cluster[0];
            let lowestProb = 1.0;
            cluster.forEach(idx => {
                if(structuralMap[idx] < lowestProb) {
                    lowestProb = structuralMap[idx];
                    safestInCluster = idx;
                }
            });
            targetVariances.push(safestInCluster);
        });

        // 4. Client Seed Optimization
        // Brute force a client seed that performs exceptionally well across a spread of simulated server seeds
        // specifically for our dynamically chosen target tiles.
        const seedOptimization = this.clientSeedOptimizer.optimizeForTargetMines(
            null, // No unhashed seed available
            serverSeedHash,
            currentNonce,
            targetVariances.slice(0, safeTilesPickCount),
            mineCount,
            totalCells,
            1500, // 1.5 second search
            platform
        );

        // 5. EV Sizing & Volatility Hedging
        // Base confidence is the combinatorial odds of hitting exactly safeTilesPickCount
        let baseConfidence = 1.0;
        for (let j = 0; j < safeTilesPickCount; j++) {
            baseConfidence *= (totalCells - mineCount - j) / (totalCells - j);
        }

        // Adjust confidence slightly based on our brute-forced seed spread success
        const adjustedConfidence = baseConfidence + ((seedOptimization.safeProbability - baseConfidence) * 0.1);

        const hedgeRisk = this.hedge.calculateHedgeFactor(1.0); // Normal operation
        const rawKelly = this.allocation.calculateOptimalAllocation(adjustedConfidence, targetMultiplier, bankroll);
        const finalAllocation = rawKelly * hedgeRisk;

        const percentAlloc = bankroll > 0 ? (finalAllocation / bankroll) * 100 : 0;

        return {
            optimalClientSeed: seedOptimization.bestSeed,
            safeTilesPickCount: safeTilesPickCount,
            recommendedClusters: safeClusters,
            betSizeAllocationPercent: percentAlloc,
            confidenceScore: adjustedConfidence,
            description: `Statistically optimal play: Rotate client seed to [${seedOptimization.bestSeed}], limit picks to ${safeTilesPickCount} tiles across distinct geographical safety clusters. Bet max ${percentAlloc.toFixed(2)}% of bankroll based on Fractional Kelly.`
        };
    }
}
