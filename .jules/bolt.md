## 2024-06-11 - MarkovChainAnalyzer Memory Allocation
**Learning:** Nested Maps in highly iterative data processing classes (like transition matrices) cause massive object allocation and garbage collection overhead.
**Action:** Replace nested Map structures (e.g., `Map<number, Map<number, number>>`) with flat Typed Arrays (e.g., `Int32Array`) in computationally hot paths for O(1) continuous memory access and zero-allocation updates.
