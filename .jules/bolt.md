## 2024-04-26 - Avoid CryptoJS String Allocation in Hot Loops
**Learning:** Instantiating `CryptoJS.algo.HMAC.create` repeatedly and converting hashes to hex strings (`.toString(CryptoJS.enc.Hex)`) causes significant performance degradation due to string allocation overhead during Monte Carlo and brute-force simulations.
**Action:** Cache the HMAC instance and reuse it via `.reset()` and `.update()`. Extract values directly from the `hash.words` array using bitwise math (e.g., `(hash.words[0] >>> 0) / 4294967296`) to completely bypass hex string conversions.
