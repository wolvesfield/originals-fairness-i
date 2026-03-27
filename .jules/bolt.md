# Bolt Journal

## 2024-10-24 - crypto-js HMAC Hex Formatting Performance Bottleneck
**Learning:** In high-frequency operations (like nonce scanning in UHF web workers), continuously parsing crypto-js HMAC results via `.toString(CryptoJS.enc.Hex)` and `parseInt()` incurs massive overhead (over 2.5x slower). String allocation and hex parsing are a major bottleneck compared to the mathematical hashing operations themselves.
**Action:** Always cache the HMAC instance via `CryptoJS.algo.HMAC.create` to avoid recreation overhead. Extract exact numeric components directly using bitwise operations on the underlying `hash.words` array (e.g., `(hash.words[0] >>> 0)` for the first 32 bits) rather than generating and parsing strings.
