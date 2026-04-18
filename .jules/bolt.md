## 2024-05-18 - Optimize HMAC usage in fairness validation loops
**Learning:** Instantiating new CryptoJS.HmacSHA256 objects and converting hashes to Hex strings for every float in hot loops (Mines, Keno) is a massive performance bottleneck. Directly accessing `words[0]` of the HMAC hash and bitwise dividing by 4294967296 is far more performant than converting to hex strings and using parseInt.
**Action:** Replace `generateFloat` string-based conversion with `(hash.words[0] >>> 0) / 4294967296` inside `fairnessEngine.ts` to optimize float generation globally.
