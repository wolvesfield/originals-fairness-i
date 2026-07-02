## 2023-10-27 - [CryptoJS HMAC Optimization in Hot Loops]
**Learning:** Initializing `CryptoJS.HmacSHA256` or `CryptoJS.algo.HMAC.create` for every hash iteration is extremely slow, as is `.toString(CryptoJS.enc.Hex)` conversion when only extracting floats.
**Action:** When calculating cryptographic floats in hot loops (e.g., `generateFloat`, `calculateCrashPoint`), hoist the HMAC initialization state (`CryptoJS.algo.HMAC.create`), use a cache for the seed (e.g., `lastSeed`), and invoke `.reset()`, `.update()`, and `.finalize()`. Furthermore, parse the result using bitwise operations directly on the 32-bit `words` array (`hash.words[0] >>> 0`) to bypass hex string serialization entirely.

## 2023-10-27 - [Pre-allocated TypedArrays over Sets in Verification]
**Learning:** `new Set()` and `Array.from()` instantiation within innermost validation loops (e.g., millions of worker validations per second) cause massive V8 garbage collection overhead and limit throughput.
**Action:** Replace `Set` allocations with globally hoisted, pre-allocated `Uint8Array` mappings for collision avoidance and simple boolean checks in finite domains (like Keno's 40 numbers or Mine's 25 cells).
