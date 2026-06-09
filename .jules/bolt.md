
## 2024-05-18 - HMAC caching and string allocation in Web Workers
**Learning:** In the highly repetitive deterministic pseudo-random float generation logic across `fairnessEngine.ts` and `aimingWorker.ts`, allocating a new HMAC instance `CryptoJS.HmacSHA256` and performing string parsing (`.toString(CryptoJS.enc.Hex)` + `.slice()` + `parseInt()`) on every single iteration caused severe performance degradation (~3x slower). The engine's hot path executes these operations millions of times per Monte Carlo simulation.
**Action:** Always cache `CryptoJS.algo.HMAC.create()` instances per `serverSeed` using `.reset()` and `.update()`. Never use hex-string conversions for bits extraction; read `hashObj.words` directly using bitwise operations (`>>> 0`) for numerical conversions in hot paths.
