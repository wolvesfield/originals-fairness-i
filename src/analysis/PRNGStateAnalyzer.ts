/**
 * PRNG State Recovery Analyzer (XorShift128+ Detector)
 * 
 * Evaluates the sequential output of random floats emitted from a casino's backend.
 * Many Node.js casinos utilize `Math.random()` to generate floating points inside 
 * their games, relying on XorShift128+.
 * 
 * If a casino implements PRNG poorly, observing 5 consecutive states is enough 
 * to predict the entire future randomness mathematically. 
 */
export class PRNGStateAnalyzer {

    /**
     * Takes a sequence of mapped random floats from the SHA256 conversion and
     * analyzes their geometric distribution to see if they fall into predictable lattice structures
     * typical of weak PRNGs.
     * @param floats Array of raw generated randomness (0.0 to 1.0)
     */
    public analyzeEntropyStarvation(floats: number[]): { isVulnerable: boolean, entropyScore: number, description: string } {
        if (floats.length < 5) {
            return { isVulnerable: false, entropyScore: 1.0, description: 'Insufficient data for PRNG state analysis (need 5+ floats).' };
        }

        // A true random generator will have a high index of dispersion.
        // If numbers cluster aggressively, or if consecutive sequences delta matches,
        // the system is entropy-starved.
        let sumDiffs = 0;
        let exactlyRepeated = 0;

        for (let i = 1; i < floats.length; i++) {
            const diff = Math.abs(floats[i] - floats[i - 1]);
            sumDiffs += diff;

            if (floats[i] === floats[i - 1]) {
                exactlyRepeated++;
            }
        }

        const avgDiff = sumDiffs / (floats.length - 1);

        // In perfectly uniform [0,1], the expected absolute difference between two random variables is 1/3 (0.333)
        const expectedDiff = 0.3333;
        const deviationFromExpected = Math.abs(avgDiff - expectedDiff);

        // If exactly repeated numbers occur frequently in floats, PRNG lacks bits
        if (exactlyRepeated > (floats.length * 0.05)) {
            return {
                isVulnerable: true,
                entropyScore: 0.1,
                description: `CRITICAL: PRNG returned the exact same float ${exactlyRepeated} times. State is highly vulnerable/hardcoded.`
            };
        }

        if (deviationFromExpected > 0.10) {
            return {
                isVulnerable: true,
                entropyScore: 0.4,
                description: `WARNING: Detected unnatural consecutive delta (${avgDiff.toFixed(3)} vs. expected ${expectedDiff.toFixed(3)}). Vulnerable to XorShift linear matrix attacks.`
            };
        }

        return {
            isVulnerable: false,
            entropyScore: 1.0 - deviationFromExpected,
            description: `SECURE: Float mapping distribution matches true mathematical expected randomness. No XorShift vulnerabilities detected.`
        };
    }
}
