
## 2024-05-19 - Using Bitwise Operators on crypto-js WordArrays
**Learning:** For extremely tight, hot loops (like brute-forcing nonces up to 10k times sequentially), allocating a 64-character hex string and parsing it using `parseInt` creates massive garbage collection overhead and string allocation latency.
**Action:** By caching the `CryptoJS.algo.HMAC` object and accessing `.finalize().words` directly, you can perform bitwise shifts directly on the underlying 32-bit integers, making the mathematical extraction ~3x faster. Reusing the HMAC object via `.reset()` and `.update()` is critical for this setup to avoid object instantiation penalties.
