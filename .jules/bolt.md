
## 2024-05-19 - HMAC Optimization with crypto-js
**Learning:** Re-instantiating `CryptoJS.HmacSHA256` and serializing to hex (`.toString(CryptoJS.enc.Hex)`) inside a tight Web Worker loop causes severe GC pressure and string allocation overhead. Using `CryptoJS.algo.HMAC.create` to cache the instance and accessing `hash.words` directly using bitwise operations (`>>> 0`) instead of parsing hex strings provides massive speedups.
**Action:** When working with high-frequency crypto operations, always cache the HMAC instance, use `.reset()` and `.update()`, and extract 32-bit integers directly from the `words` array.
