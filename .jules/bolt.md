## 2024-05-30 - Crypto-js optimization

**Learning:** Optimizing synchronous hot paths using `crypto-js` by caching the HMAC instance via `CryptoJS.algo.HMAC.create` and reusing it using `.reset()` and `.update()`, as well as accessing the `words` array directly with bitwise shifts (e.g., `hash.words[0] >>> 0`) rather than converting to a hex string with `.toString(CryptoJS.enc.Hex)` provides a significant performance boost (over 2x faster). This is critical for brute-forcing operations inside `aimingWorker.ts`.
**Action:** When working on ultra-high frequency tasks involving `crypto-js`, apply the `.reset()` / `.update()` and bitwise shift optimizations.
