
## 2024-04-02 - Hoisting static data and using O(1) Lookups in Express Scan Loops
**Learning:** In headless high-frequency Express routes (like nonce scanning in `/aim/mines` and `/aim/keno`), creating static structures like lookup arrays (`Array.from({length: ...})`) or iterating repeatedly using `Array.prototype.includes` heavily impacts throughput.
**Action:** When implementing scanning or search operations in a loop, always aggressively hoist static bounds and pre-computation outside the loop, and convert lists into `Set`s for O(1) membership `.has()` lookups in place of O(N) `.includes()`.
