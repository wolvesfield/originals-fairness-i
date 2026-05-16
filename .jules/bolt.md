## 2024-05-18 - Single-Pass Map Operations in Hot Paths
**Learning:** In highly repetitive loops, multiple `Map.has()` followed by `Map.get()!` or `Map.set()` operations can cause significant overhead.
**Action:** Always use single-pass Map operations in hot paths. Store the result of `.get()` in a local variable, perform an `undefined` check, and use that result to eliminate redundant lookups. Also, cache intermediate counts in inner loops and replace `for...of` loops over arrays with standard `for` loops.
