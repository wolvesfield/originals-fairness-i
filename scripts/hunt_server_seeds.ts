import { EntropyVulnerabilityScanner } from '../src/analysis/EntropyVulnerabilityScanner';
import SHA256 from 'crypto-js/sha256';

async function runLiveHunt() {
    console.log("=========================================================");
    console.log("🚀 ACTIVATING ENTROPY VULNERABILITY SCANNER (TIME-BASED) ");
    console.log("=========================================================\n");

    const scanner = new EntropyVulnerabilityScanner();

    // MOCKING A WEAK CASINO SERVER:
    // Imagine the casino generated their server seed 24 hours ago using just the UNIX millisecond timestamp.
    // This reduces the $2^{256}$ keyspace down to a minuscule dictionary of integers.
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const currentTime = Date.now();
    const actualCreationTime = currentTime - ONE_DAY_MS + 45231; // yesterday + ~45 seconds (arbitrary)

    const weakServerSeed = `${actualCreationTime}`;
    const targetHash = SHA256(weakServerSeed).toString();

    console.log(`[TARGET] Active Hashed Server Seed: ${targetHash}`);
    console.log(`[INFO] Attempting dictionary attack assuming time-based PRNG entropy bias.\n`);

    // SCANNING THE WINDOW:
    // We define a sweep window. In a real-world scenario, if you know you clicked "Rotate Seed"
    // roughly 24 hours ago, you might scan a 48-hour window (172,800,000 hashes).
    // For this simulation's speed, we'll scan a precise 2-hour window bounding the creation time
    // which equates to 7.2 million SHA-256 computations in JavaScript.

    const windowStart = actualCreationTime - (60 * 60 * 1000); // 1 hour prior
    const windowEnd = actualCreationTime + (60 * 60 * 1000);   // 1 hour ahead

    console.log(`[SCANNER] Sweeping keyspace timestamp window: ${windowStart} up to ${windowEnd}`);
    console.log(`[SCANNER] Keyspace Size: ${(windowEnd - windowStart).toLocaleString()} combinations...`);
    console.log(`[SCANNER] Computing hashes... Please wait... (This may take a few seconds)`);

    try {
        const result = await scanner.scanTimeWindow(targetHash, windowStart, windowEnd, '');

        console.log("\n=========================================================");
        if (result.found) {
            console.log("🚨 CRITICAL VULNERABILITY EXPLOITED! 🚨");
            console.log(`[+] Unhashed Server Seed    : ${result.seed}`);
            console.log(`[+] Total Hashes Computed   : ${result.scannedHashes.toLocaleString()}`);
            console.log(`[+] Compute Velocity        : ${Math.floor(result.scannedHashes / (result.timeMs / 1000)).toLocaleString()} hashes/sec`);
            console.log(`[+] Time Elapsed            : ${(result.timeMs / 1000).toFixed(2)} seconds`);
            console.log(`[+] Cryptographic Verification: ${SHA256(result.seed!).toString() === targetHash ? "VERIFIED VALID" : "FAILED"}`);

            console.log("\n[!] FATAL BREACH:");
            console.log("[!] The active unrevealed server seed has been mathematically recovered.");
            console.log("[!] You now have 100% deterministic prediction accuracy for this seed's future rounds.");
        } else {
            console.log("✅ NO VULNERABILITY DETECTED in this time window.");
            console.log(`[-] Total Hashes Computed   : ${result.scannedHashes.toLocaleString()}`);
            console.log(`[-] Time Elapsed            : ${(result.timeMs / 1000).toFixed(2)} seconds`);
            console.log("\n[!] The casino appears to be using a cryptographically secure TRNG for this seed.");
        }
        console.log("=========================================================\n");

    } catch (e) {
        console.error("Scan failed: ", e);
    }
}

runLiveHunt();
