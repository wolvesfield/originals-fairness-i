## 2024-03-01 - Pre-allocating Uint8Arrays in tight loops
**Learning:** For ultra-high frequency tasks like brute-force scanning in web workers (`src/workers/aimingWorker.ts`), creating `new Set()` or `Array.from()` inside tight loops causes massive garbage collection overhead that significantly degrades performance.
**Action:** Always prefer pre-allocating state and lookup structures like `Uint8Array` outside of the tight loops and resetting them iteratively to heavily reduce garbage collection and instantiation overhead.
