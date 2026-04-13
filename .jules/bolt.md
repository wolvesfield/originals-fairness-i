
## 2024-05-18 - Replacing O(N) Array Lookups with O(1) Set Lookups in High-Frequency Scan Loops
**Learning:** In tight, high-frequency iteration loops (like the Nonce Scanning loops in `/aim/mines` and `/aim/keno`), `Array.includes()` for hit-detection acts as a major performance bottleneck due to its O(N) complexity. Furthermore, static arrays derived directly from constants (e.g., creating the base array of all board tiles) can be redundantly allocated on every iteration if initialized inside the loop.
**Action:** Always hoist the initialization of static arrays outside of scan loops. Convert small subset arrays (e.g., drawn items, mines) into `Set` instances immediately within the loop to change membership validation (e.g., `drawnSet.has(p)`) from O(N) to O(1) time complexity.
