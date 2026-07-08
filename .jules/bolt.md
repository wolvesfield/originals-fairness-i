## 2024-07-08 - [Aiming Worker GC Pressure]
**Learning:** Instantiating `new Set()` inside highly repetitive Web Worker brute-force loops (like scanning millions of nonces) causes significant GC pressure and slowdowns.
**Action:** Replace `Set` allocations inside tight loops with globally hoisted typed arrays (`Uint8Array`) that are reset (`.fill(0)`) across iterations. This eliminates allocation spikes and speeds up collision detection (e.g. Keno by ~30%, Mines by ~20%).
