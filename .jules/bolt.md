# Bolt's Journal

## 2024-05-18 - Optimizing ultra-high frequency cryptography loops
**Learning:** Instantiating `CryptoJS.HmacSHA256` and parsing the text to hex with `.toString(CryptoJS.enc.Hex)` on every iteration is extremely slow because it forces string allocation, hex decoding, and intermediate garbage collection in hot paths. Additionally, allocating a new `Set` or `Array` recursively in hot worker loops causes severe GC pausing.
**Action:** When evaluating loops with thousands of executions per second (e.g., nonce brute-forcing in workers), re-use a stateful HMAC via `CryptoJS.algo.HMAC.create`, extract the 32-bit `words` directly instead of hex strings, and pre-allocate fixed `Uint8Array` buffers outside the loop for array mapping to completely bypass memory allocations.
