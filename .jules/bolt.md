## 2024-05-24 - Typed Arrays vs Maps in Iterative Matrix Processing
**Learning:** In the `MarkovChainAnalyzer`, replacing `Map<number, Map<number, number>>` with a pre-allocated 1D `Int32Array` of size `gridSize * gridSize` (using math `origin * gridSize + destination`) avoids garbage collection and memory overhead resulting in an order-of-magnitude performance improvement during hot-path execution.
**Action:** Use 1D typed arrays (like `Int32Array`) instead of nested Map or Object dictionaries for fixed-size statistical matrices (e.g., transition grids, heatmaps) in tight loops.

## 2024-05-24 - Jest with ES Modules and Artifact Contamination
**Learning:** Deleting tracked `.js` artifacts in `src/` is necessary when running tests with `NODE_OPTIONS=--experimental-vm-modules pnpm exec jest` because Jest will inadvertently resolve imports to the compiled `.js` files instead of the `.ts` files, causing `ERR_MODULE_NOT_FOUND` errors when exports are missing.
**Action:** Always clean up `.js` build artifacts within `src/` using `find src -name "*.js" -type f -delete` prior to running Jest tests if they cause module resolution conflicts.
