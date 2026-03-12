
## 2025-02-28 - Optimizing Synchronous Hot Paths using CryptoJS
**Learning:** `CryptoJS.algo.HMAC.create` has a high instantiation cost and can cause memory leaks in unbounded data structures. `CryptoJS.HmacSHA256` runs this creation every time under the hood. For hot paths like generating high volumes of deterministic floats (e.g., Mines aiming), converting the word arrays to Hex strings and re-parsing to Int is expensive.
**Action:** Use a bounded LRU cache (e.g. Map with size eviction) for `HMAC.create` instances. To extract float values quickly, skip hex string conversion entirely by using bitwise shifts directly on the first word of the finalized HMAC hash array (`hash.words[0] >>> 0`).
