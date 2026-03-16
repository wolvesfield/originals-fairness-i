## 2024-05-18 - CryptoJS HMAC Performance Bottleneck
**Learning:** Instantiating new HMAC instances with `CryptoJS.HmacSHA256(message, serverSeed)` has huge overhead (approx 2.3s per 50,000 iterations).
Using `CryptoJS.algo.HMAC.create` and reusing the instance via `.reset()` and `.update()` cuts computation time by over 50% (approx 1.0s per 50k iterations), without losing precision. This is crucial for ultra-high-frequency scanning and simulation.
**Action:** Created `HMACCaching` in `src/utils/hmacCache.ts` to implement a bounded LRU cache for HMAC instances. In the future, prefer using cached `CryptoJS.algo.HMAC` instances over the static helper methods when doing bulk/repetitive computations.
