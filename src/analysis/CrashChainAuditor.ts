import SHA256 from 'crypto-js/sha256';
import hmacSHA256 from 'crypto-js/hmac-sha256';

export interface CrashValidationResult {
    gameIndex: number;
    expectedMultiplier: number;
    actualMultiplier: number; // After rounding logic
    instantCrash: boolean;
    floorBiasDetected: boolean;
    serverSeed: string;
}

/**
 * Crash Hash Chain & Floor Bias Auditor
 * 
 * Crash platforms like Roobet use a 10M iteration hash chain backwards.
 * By verifying the chain computationally, we can ensure the casino didn't skip
 * a server seed to force a loss. We also audit the Exact Float Modulo Bias
 * to verify if the casino's rounding logic steals percentage points.
 */
export class CrashChainAuditor {
    private readonly ROOBET_SALT = '0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c';

    /**
     * Derive the actual crash multiplier from a server seed according to standard Crash logic
     */
    public calculateMultiplier(serverSeed: string, salt: string = this.ROOBET_SALT): { mult: number, instant: boolean, exact: number } {
        const hash = hmacSHA256(serverSeed, salt).toString();

        // Divisibility logic (1 in 20 instant crash base edge)
        const hs = parseInt(hash.slice(0, 8), 16);
        if (hs % 20 === 0) {
            return { mult: 1.00, instant: true, exact: 1.00 }; // Instant crash
        }

        // Multiplier calculation from 52-bits
        const hStr = hash.slice(0, 13);
        const h = parseInt(hStr, 16);
        const e = Math.pow(2, 52);

        // Raw exact multiplier before rounding
        const exactMult = (100 * e - h) / (e - h) / 100;

        // Floored multiplier (where casinos usually hide extra edge)
        const flooredMult = Math.floor((100 * e - h) / (e - h)) / 100;

        return { mult: Math.max(1.00, flooredMult), instant: false, exact: exactMult };
    }

    /**
     * Audits a historical chain starting from a recent known seed, hashing it to find previous games.
     * Game N uses seed S_N. Game N-1 uses S_{N-1} where S_N = SHA256(S_{N-1}).
     * Wait, to go backwards in time (find older games), we hash the recent seed.
     * Because OlderSeed = SHA256(NewerSeed).
     */
    public auditReverseChain(latestServerSeed: string, lengthToAudit: number = 1000): CrashValidationResult[] {
        const results: CrashValidationResult[] = [];
        let currentSeed = latestServerSeed;

        for (let i = 0; i < lengthToAudit; i++) {
            const { mult, instant, exact } = this.calculateMultiplier(currentSeed);

            // Calculate Floor Bias: If the exact math said 1.009x but the system floored it to 1.00x,
            // that's a "Floor Bias" loss for the player that isn't advertised in the flat 5% instant crash.
            const floorBias = exact > 1.00 && mult === 1.00;

            results.push({
                gameIndex: i, // 0 = most recent
                expectedMultiplier: exact,
                actualMultiplier: mult,
                instantCrash: instant,
                floorBiasDetected: floorBias,
                serverSeed: currentSeed
            });

            // Chain backwards to the prev game's seed
            currentSeed = SHA256(currentSeed).toString();
        }

        return results;
    }
}
