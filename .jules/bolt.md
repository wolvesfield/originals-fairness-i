## 2025-02-18 - Fast Deterministic Float Generation from HMAC-SHA256
**Learning:** Instantiating `CryptoJS.HmacSHA256` and coercing it to a hex string (`.toString(CryptoJS.enc.Hex)`), then back to an integer (`parseInt()`) for float division is extremely slow in hot-paths like Monte Carlo or Worker brute-force scanning.
**Action:** Use `CryptoJS.algo.HMAC.create()` to cache the HMAC context per `serverSeed`. Use `.reset()` and `.update()`. Finally, extract the first 32 bits natively via `hash.words[0] >>> 0` and divide by `4294967296` to bypass all string instantiation for ~2.5x speedups.
