## 2025-04-29 - HMAC caching and float bitwise calculation
**Learning:** For deterministic float calculations using CryptoJS HMAC, caching the HMAC instance and calculating float using the bitwise representation instead of hex conversion provides significant performance gains (~2.7x faster).
**Action:** Always prefer caching the HMAC instance (`CryptoJS.algo.HMAC.create`) over creating new instances and using `reset`/`update`, and prefer reading the underlying hash words via `(hash.words[0] >>> 0) / 4294967296` instead of converting to hex string first.
