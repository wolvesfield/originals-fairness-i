## 2024-05-24 - Optimized float generation HMAC performance
**Learning:** `CryptoJS` string and parsing operations inside high-frequency float generation are massive bottlenecks. Using `.toString(CryptoJS.enc.Hex)` and parsing it back with `parseInt` is very expensive.
**Action:** Use cached HMAC instances with `.reset()` and `.update()`. Access the digest as a 32-bit integer directly from the words array (`hash.words[0] >>> 0`) to achieve a ~60% reduction in generation time.
