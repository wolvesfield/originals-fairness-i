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
    private transitionMatrix: Int32Array;
    private frequencies: Int32Array;
    private gridSize: number;

    constructor(gridSize: number = 25) {
        this.gridSize = gridSize;
        this.transitionMatrix = new Int32Array(gridSize * gridSize);
        this.frequencies = new Int32Array(gridSize);
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
                // Track how often a general mine originates from here
                this.frequencies[originTile]++;

                const offset = originTile * this.gridSize;
                for (const destTile of nextRound) {
                    this.transitionMatrix[offset + destTile]++;
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
            const totalTransitions = this.frequencies[originTile];
            if (totalTransitions === 0) continue;

            const offset = originTile * this.gridSize;

            for (let destTile = 0; destTile < this.gridSize; destTile++) {
                const count = this.transitionMatrix[offset + destTile];
                if (count > 0) {
                    const transitionProb = count / totalTransitions;
                    predictionMap[destTile] += transitionProb;
                }
            }
        }

        // Normalize probabilities against the base cluster rate
        return predictionMap;
    }
}
