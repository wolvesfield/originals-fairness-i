## 2025-04-25 - Direct Word Extraction from CryptoJS
**Learning:** Using `hash.words` array bitwise operations from CryptoJS objects directly instead of converting them to hex strings and using `parseInt` significantly improves performance in hot loops by avoiding string allocations.
**Action:** Always prefer direct bitwise extraction `(hash.words[0] >>> 0)` for floats or large integers when dealing with CryptoJS hashes in high-frequency operations.
