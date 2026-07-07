
## 2024-05-18 - Fairness Engine Hot-Path Optimizations
**Learning:** Instantiating `Set` objects and parsing/slicing hex strings for `HMAC-SHA256` generation within tight loops (like Web Worker brute-force scans and Monte Carlo simulations) causes severe performance bottlenecks due to garbage collection (GC) pressure and string allocation overhead. Using `.toString(CryptoJS.enc.Hex)` in hot loops creates enormous amounts of string garbage.
**Action:** Always pre-allocate typed arrays (e.g. `new Uint8Array(256)`) globally for collision detection instead of `Set`, and cache `CryptoJS.algo.HMAC.create` instances. Use bitwise extraction (`words[0] >>> 0`) on the finalized hash to retrieve numerical representations rather than hex string parsing.
