
## 2024-08-01 - Avoid Set allocations in hot worker loops
**Learning:** Instantiating `new Set()` and calling `Array.from()` inside tight, brute-force Web Worker loops (like `validateKenoState`) creates severe garbage collection pressure, significantly reducing throughput.
**Action:** Replace `Set` with pre-allocated `Uint8Array` collision maps. When validating states, hoist the arrays to the global scope (`self._map = new Uint8Array()`) and clear them with `.fill(0)` to completely eliminate per-iteration allocations. Additionally, use early returns as soon as the target condition is met to skip unnecessary iterations.
