## 2025-05-02 - Deterministic float optimization
**Learning:** Found a major bottleneck in JS deterministic float generation when using `CryptoJS.HmacSHA256().toString(CryptoJS.enc.Hex)`. The hex string conversion and subsequent `.slice(0, 8)` + `parseInt(..., 16)` is significantly slower than directly accessing the first 32-bit word of the HMAC via bitwise shifts `(hash.words[0] >>> 0)`.
**Action:** Implemented word extraction directly from the CryptoJS `words` array.
