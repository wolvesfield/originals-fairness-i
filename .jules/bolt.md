## 2025-04-19 - Pre-process arrays to Sets for hot loop lookups
**Learning:** Instantiating `Set` objects dynamically inside hot loops (like the inner hill-climbing mutations in `HeuristicSeedEngineer.ts`) can incur significant overhead, but array `.includes()` is O(N).
**Action:** Pre-process static arrays into Sets *outside* of hot loops (e.g. before the main execution block) and pass the pre-computed Sets into the loop functions to achieve O(1) membership lookups without the instantiation penalty.
