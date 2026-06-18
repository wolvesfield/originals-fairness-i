## 2025-03-09 - Keno Set allocation performance
**Learning:** `generateKenoNumbers` was previously instantiating a `Set` for collision detection in hot loops. The use of a boolean array (or Uint8Array) mapping the small possible number domain (usually up to 40) is significantly faster and avoids object allocation.
**Action:** Replace `Set` with typed boolean map arrays and cache the HMAC state for `generateKenoNumbers` and `validateKenoState` to optimize cryptographic hot loops in both `fairnessEngine.ts` and `aimingWorker.ts`.
