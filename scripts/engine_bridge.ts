import { ClosestToWinEngine } from '../src/analysis/ClosestToWinEngine';
import * as fs from 'fs';

async function main() {
    try {
        const inputData = fs.readFileSync('temp_history.json', 'utf8');
        const payload = JSON.parse(inputData);
        
        // Normally we'd pass the recentBets into the engine, but for this bridge
        // we'll execute it against whatever internal static state it needs
        // assuming MasterController isn't needed for a headless run.
        
        // Simulating the Board generation based on the engine
        const totalGames = payload.recentBets ? payload.recentBets.length : 100;
        
        // Create an instance of the engine
        const engine = new ClosestToWinEngine();
        
        // Parse history to match exactly what MarkovChainAnalyzer expects (number[][])
        // We assume payload.recentBets provides raw indices or we mock it if empty
        let parsedHistory: number[][] = [];
        if (payload.recentBets && Array.isArray(payload.recentBets)) {
            parsedHistory = payload.recentBets.map((bet: any) => {
                if (bet.state && bet.state.rounds) {
                    return bet.state.rounds.map((r: any) => r.field);
                }
                return [];
            }).filter((arr: number[]) => arr.length > 0);
        }

        // Default configuration for a typical session simulation
        const recommendation = engine.analyzeOptimalStrategy(
            "dummy-server-hash",
            payload.recentBets ? payload.recentBets.length : 1,
            3, // 3 Mines
            25, // 25 total cells
            payload.balance || 0.01,
            1.5, // Target multiplier buffer
            'stake',
            parsedHistory // <-- Pass the parsed markov sequence!
        );

        // Convert recommendation to stdout JSON for Python
        const output = {
            confidence: recommendation.confidenceScore,
            targetTiles: recommendation.recommendedClusters.map(c => c[0]), // Pick the safest tile from each cluster
            multiplier: 1.5, // Standard simulated multiplier
            expectedReturn: 0,
            suggestedClientSeed: recommendation.optimalClientSeed
        };
        
        console.log(JSON.stringify(output));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
