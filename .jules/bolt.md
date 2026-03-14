## 2024-05-24 - Initial setup
**Learning:** Just starting out as Bolt.
**Action:** Let's find some performance to optimize.

## 2024-05-24 - HMAC Instance Caching and Bitwise Hash Extraction
**Learning:** Instantiating `CryptoJS.algo.HMAC.create` inside a hot loop (like a worker scanning nonces) causes massive garbage collection overhead. Caching the HMAC instance in an LRU cache and reusing it via `.reset()` and `.update()` provides a >2x performance boost. Furthermore, parsing a hex string `hash.toString(CryptoJS.enc.Hex)` to float via `parseInt` can be avoided by directly accessing `hash.words` with unsigned right shifts (e.g., `hash.words[0] >>> 0`). However, when calling `CryptoJS.algo.HMAC.create`, passing the `serverSeed` directly instead of parsing it as Hex first is critical to maintaining the same byte interpretation and preventing regressions in deterministic outcomes.
**Action:** Use an LRU cache for HMAC instances and bitwise extraction for hot paths, but be extremely careful not to accidentally parse the key as hex if the original implementation didn't.
