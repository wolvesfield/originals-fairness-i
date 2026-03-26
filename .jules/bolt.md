## 2024-03-26 - CryptoJS HMAC Object Reuse
**Learning:** Reusing the CryptoJS.algo.HMAC instance via `.reset()` and `.update()` and accessing `.words[0] >>> 0` directly instead of `.toString(CryptoJS.enc.Hex)` and `parseInt` provides over 2.5x speedup for generating deterministic floats.
**Action:** Use this optimization in ultra-high frequency scanning logic like `aimingWorker.ts` and `fairnessEngine.ts`.
