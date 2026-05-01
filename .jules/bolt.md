## 2024-05-15 - Fast HMAC words extraction
**Learning:** In highly repetitive loops calling HMAC (like crash algorithms and random float generation), converting the crypto-js HMAC output to a hex string and back to numbers is slow.
**Action:** Use `crypto-js` to extract the `words` directly and use bitwise math (e.g. `(words[0] >>> 0) / 4294967296` for float or `(words[0] >>> 0) * 1048576 + (words[1] >>> 12)` for 52-bit integer).
