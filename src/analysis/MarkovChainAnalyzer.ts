/**
 * Markov Chain Temporal Analyzer
 * 
 * Cryptographic RNG systems are structurally random, but the Fisher-Yates shuffle
 * acting over float derivations can exhibit micro-temporal biases across sequences.
 * This analyzer ingests the historical chain of games (nonce N-x to N) and builds 
 * a transitional probability matrix to predict where mines are statistically likely 
 * to shift to next.
 */
export class MarkovChainAnalyzer {
    private transitionMatrix: Map<number, Map<number, number>>;
    private frequencies: Map<number, number>;
    private gridSize: number;

    constructor(gridSize: number = 25) {
        this.transitionMatrix = new Map();
        this.frequencies = new Map();
        this.gridSize = gridSize;
    }

    /**
     * Push historical sequential mine patterns into the matrix
     * @param sequence Array of historical mine placements ordered by nonce sequentially 
     */
    public ingestHistory(sequence: number[][]) {
        for (let i = 0; i < sequence.length - 1; i++) {
            const currentRound = sequence[i];
            const nextRound = sequence[i + 1];

            // For each mine location in the current round, log where EVERY mine went in the next round
            // This builds a transitional heat weight
            for (const originTile of currentRound) {
                if (!this.transitionMatrix.has(originTile)) {
                    this.transitionMatrix.set(originTile, new Map());
                }

                const destinationMap = this.transitionMatrix.get(originTile)!;

                // Track how often a general mine originates from here
                this.frequencies.set(originTile, (this.frequencies.get(originTile) || 0) + 1);

                for (const destTile of nextRound) {
                    destinationMap.set(destTile, (destinationMap.get(destTile) || 0) + 1);
                }
            }
        }
    }

    /**
     * Predict the probability overlay for the very next nonce
     * @param currentMinePositions Where the mines were in the last known nonce
     */
    public predictNextState(currentMinePositions: number[]): number[] {
        const predictionMap = new Array(this.gridSize).fill(0);

        for (const originTile of currentMinePositions) {
            if (!this.transitionMatrix.has(originTile)) continue;

            const destinationMap = this.transitionMatrix.get(originTile)!;
            const totalTransitions = this.frequencies.get(originTile) || 1;

            for (const [destTile, count] of destinationMap.entries()) {
                const transitionProb = count / totalTransitions;
                predictionMap[destTile] += transitionProb;
            }
        }

        // Normalize probabilities against the base cluster rate
        return predictionMap;
    }
}
