
## 2024-06-10 - Crypto-js HMAC parsing performance bottleneck
**Learning:** In highly repetitive cryptographic hot paths within the application (calculating deterministic floats and Crash multipliers in `fairnessEngine` and `aimingWorker`), using `.toString(CryptoJS.enc.Hex)` on an HMAC instance and then parsing it backwards using string slicing or string representations is incredibly slow due to memory allocation and hex conversions.
**Action:** Instead, directly cache the HMAC instance using `CryptoJS.algo.HMAC.create` to avoid rebuilding state, and immediately pull raw bytes off `hash.words` utilizing bitwise shifts (e.g. `hash.words[0] >>> 0` or mathematical combining like `w0 * 1048576 + (w1 >>> 12)`). This avoids string allocation overhead entirely and runs ~2.5x faster.
