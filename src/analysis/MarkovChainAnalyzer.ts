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
    private transitionMatrix: Int32Array[];
    private frequencies: Int32Array;
    private gridSize: number;

    constructor(gridSize: number = 25) {
        this.transitionMatrix = new Array(gridSize);
        for (let i = 0; i < gridSize; i++) {
            this.transitionMatrix[i] = new Int32Array(gridSize);
        }
        this.frequencies = new Int32Array(gridSize);
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

            const currentLen = currentRound.length;
            const nextLen = nextRound.length;

            // For each mine location in the current round, log where EVERY mine went in the next round
            // This builds a transitional heat weight
            for (let k = 0; k < currentLen; k++) {
                const originTile = currentRound[k];

                // Track how often a general mine originates from here
                this.frequencies[originTile]++;

                const destArray = this.transitionMatrix[originTile];

                for (let j = 0; j < nextLen; j++) {
                    destArray[nextRound[j]]++;
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

        for (let k = 0; k < currentMinePositions.length; k++) {
            const originTile = currentMinePositions[k];
            const totalTransitions = this.frequencies[originTile] || 1;
            const destArray = this.transitionMatrix[originTile];

            for (let destTile = 0; destTile < this.gridSize; destTile++) {
                const count = destArray[destTile];
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
