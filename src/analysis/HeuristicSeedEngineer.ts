import { generateMinePositions } from '../utils/fairnessEngine';

export interface AnchorRound {
    nonce: number;
    mines: number[];
}

export interface HeuristicResult {
    bestSeed: string;
    matchAccuracy: number; // 0.0 to 1.0
    generations: number;
    timeMs: number;
}

/**
 * Michael Powers Iterative Search Strategy (Heuristic Seed Engineer)
 * 
 * Directly reversing SHA-256 is physically impossible. However, if a player
 * plays thousands of rounds on a single hidden server seed, the outcomes themselves 
 * "leak" mathematical state. By taking extremely rare rounds (anchors) and applying 
 * a hill-climbing mutation loop to a candidate seed, we can theoretically breed a 
 * synthetic server seed that mimics the real server seed's future probabilities.
 */
export class HeuristicSeedEngineer {
    private generateRandomHex(length: number = 64): string {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    private mutateSeed(seed: string, mutationRate: number = 0.05): string {
        const chars = '0123456789abcdef';
        let mutated = '';
        for (let i = 0; i < seed.length; i++) {
            if (Math.random() < mutationRate) {
                mutated += chars.charAt(Math.floor(Math.random() * chars.length));
            } else {
                mutated += seed[i];
            }
        }
        return mutated;
    }

    /**
     * Scores how closely a candidate seed matches the exact anchor outcomes
     */
    private scoreSeed(
        candidateSeed: string,
        clientSeed: string,
        anchors: AnchorRound[],
        mineCount: number,
        totalCells: number
    ): number {
        let totalMinesMatched = 0;
        const maxPossibleMatches = anchors.length * mineCount;

        for (const anchor of anchors) {
            const generated = generateMinePositions(candidateSeed, clientSeed, anchor.nonce, mineCount, totalCells);
            // Count exact position overlaps
            // Performance: Manual inner loop with early break outperforms .includes() for small arrays
            const ancLen = anchor.mines.length;
            const genLen = generated.length;
            for (let j = 0; j < ancLen; j++) {
                const m = anchor.mines[j];
                for (let k = 0; k < genLen; k++) {
                    if (generated[k] === m) {
                        totalMinesMatched++;
                        break;
                    }
                }
            }
        }

        return totalMinesMatched / maxPossibleMatches;
    }

    /**
     * Execute the hill-climbing algorithm to breed a synthetic seed
     */
    public async breedSyntheticSeed(
        clientSeed: string,
        anchors: AnchorRound[],
        mineCount: number = 3,
        totalCells: number = 25,
        maxGenerations: number = 5000
    ): Promise<HeuristicResult> {
        return new Promise((resolve) => {
            const startTime = performance.now();
            let bestSeed = this.generateRandomHex();
            let bestScore = this.scoreSeed(bestSeed, clientSeed, anchors, mineCount, totalCells);
            let generation = 0;

            const runBatch = () => {
                const batchEnd = Math.min(generation + 500, maxGenerations);

                while (generation < batchEnd) {
                    generation++;

                    // Create a child seed with minute mutations
                    const childSeed = this.mutateSeed(bestSeed, 0.03); // 3% mutation
                    const childScore = this.scoreSeed(childSeed, clientSeed, anchors, mineCount, totalCells);

                    // If child fits the historical anchor data better, it becomes the new parent
                    if (childScore > bestScore) {
                        bestScore = childScore;
                        bestSeed = childSeed;
                    }

                    // If we hit perfect accuracy on the anchors, stop breeding immediately
                    if (bestScore === 1.0) break;
                }

                if (bestScore === 1.0 || generation >= maxGenerations) {
                    resolve({
                        bestSeed,
                        matchAccuracy: bestScore,
                        generations: generation,
                        timeMs: performance.now() - startTime
                    });
                } else {
                    // Release thread and continue
                    setTimeout(runBatch, 0);
                }
            };

            runBatch();
        });
    }
}
