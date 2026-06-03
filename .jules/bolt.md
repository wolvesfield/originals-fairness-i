## 2024-05-30 - CryptoJS HMAC Cache and Bitwise Operations
**Learning:** Instantiating CryptoJS HMAC instances repeatedly inside a loop and converting them to Hex strings for float derivation is extremely slow (~3.9s per 100k vs ~1.5s per 100k).
**Action:** When deriving floats from HMAC, cache the HMAC instance using `CryptoJS.algo.HMAC.create`, `hmac.reset()`, `hmac.update()`, and extract the first 32 bits natively using `hash.words[0] >>> 0` rather than hex parsing.

## 2024-05-30 - Small Sets vs Arrays in Hot Paths
**Learning:** For small collections (N < 50), such as generating 10 Keno numbers, `new Set()` and `Array.from()` instantiation overhead is 2-4x slower than simple `Array.includes()` or bitmask checks.
**Action:** Avoid `new Set()` for small, frequent collections in hot loops like brute-force hashing.
## 2024-05-30 - Keno Bitmask Limits
**Learning:** Keno standardizes on 80 numbers. JavaScript bitwise operations max out at 32-bit signed integers. When converting arrays/sets to bitmasks for fast collision detection, a single 32-bit integer is insufficient, and using two masks (64 bits total) is also insufficient and creates a silent timebomb for numbers >= 64, causing array index out-of-bounds or wrap-around (e.g. 1 << 64).
**Action:** When using bitmasks for items that may exceed index 63, strictly use enough masks. For max 80, three 32-bit integers (`mask1` < 32, `mask2` < 64, `mask3` < 96) must be used to ensure correctness.
