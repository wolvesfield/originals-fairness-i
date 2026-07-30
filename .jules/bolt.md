## 2024-05-18 - CryptoJS HMAC Optimization
**Learning:** Calling `CryptoJS.HmacSHA256` allocates and serializes states repetitively. Also `.toString(CryptoJS.enc.Hex)` and `parseInt` causes huge GC pressure and CPU overhead in hot loops.
**Action:** In ultra-high frequency loops, cache the initialized `CryptoJS.algo.HMAC.create` state per `serverSeed`. Retrieve the integer values directly from the 32-bit `hash.words` array (`hashObj.words[0] >>> 0`) instead of performing expensive hex string conversions. This more than doubles performance in brute-force scanning paths.
